const elements = {
  yearSelect: document.querySelector("#year-select"),
  grid: document.querySelector("#months-grid"),
  loading: document.querySelector("#loading-state"),
  heroYear: document.querySelector("#hero-year"),
  heading: document.querySelector("#calendar-heading"),
  pastMonthsToggle: document.querySelector("#past-months-toggle"),
  dialog: document.querySelector("#day-dialog"),
  dialogDate: document.querySelector("#dialog-date"),
  dialogEvents: document.querySelector("#dialog-events"),
  dialogClose: document.querySelector("#dialog-close"),
};

const state = {
  manifest: null,
  calendar: null,
  eventsByDate: new Map(),
  showPastMonths: false,
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value) {
  if (!isoDatePattern.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function parseMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function toDateKey(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function monthSequence(startValue, endValue) {
  const months = [];
  const end = parseMonth(endValue);
  let cursor = parseMonth(startValue);

  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return months;
}

function isPastMonth(monthDate) {
  const today = new Date();
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return monthDate < currentMonth;
}

function isCurrentSchoolYear(calendar) {
  const today = new Date();
  const start = parseMonth(calendar.startMonth);
  const lastMonth = parseMonth(calendar.endMonth);
  const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);
  return today >= start && today <= end;
}

function currentSchoolYearId() {
  const today = new Date();
  const startYear = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function eventColor(categoryId) {
  return state.calendar.categories[categoryId]?.color || "#66716c";
}

function categoryLabel(categoryId) {
  return state.calendar.categories[categoryId]?.label || categoryId;
}

function eventPriority(categoryId) {
  if (categoryId === "family") return 0;
  if (categoryId === "hold") return 2;
  return 1;
}

function orderEvents(events) {
  return [...events].sort(
    (first, second) => eventPriority(first.category) - eventPriority(second.category),
  );
}

function eventsForDayDisplay(events) {
  const examDay = events.some((event) => event.category === "exam");
  if (!examDay) return events;

  return events.filter((event) => event.category === "exam" || event.category === "family");
}

function validateCalendar(calendar) {
  const required = ["id", "label", "startMonth", "endMonth", "categories", "events"];
  for (const key of required) {
    if (!(key in calendar)) {
      throw new Error(`Calendar data is missing “${key}”.`);
    }
  }

  for (const event of calendar.events) {
    if (!event.id || !event.title || !event.category || !event.start || !event.end || !event.location) {
      throw new Error("Every event needs an id, title, category, start date, end date, and location.");
    }
    if (!calendar.categories[event.category]) {
      throw new Error(`Unknown category “${event.category}” on event “${event.title}”.`);
    }
    if (parseDate(event.start) > parseDate(event.end)) {
      throw new Error(`Event “${event.title}” ends before it starts.`);
    }
  }
}

function buildEventIndex(events) {
  const index = new Map();

  for (const event of events) {
    let cursor = parseDate(event.start);
    const end = parseDate(event.end);
    let days = 0;

    while (cursor <= end && days < 550) {
      const key = toDateKey(cursor);
      const existing = index.get(key) || [];
      existing.push(event);
      index.set(key, existing);
      cursor = addDays(cursor, 1);
      days += 1;
    }
  }

  return index;
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat(state.calendar.locale || "en-GB", options).format(date);
}

function formatRange(event) {
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  const options = { day: "numeric", month: "long", year: "numeric" };

  if (event.start === event.end) {
    return formatDate(start, options);
  }

  return `${formatDate(start, options)} – ${formatDate(end, options)}`;
}

function renderYearOptions() {
  elements.yearSelect.replaceChildren();
  for (const year of state.manifest.years) {
    const option = document.createElement("option");
    option.value = year.id;
    option.textContent = year.label;
    elements.yearSelect.append(option);
  }
}

function getWeekdayLabels() {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, index) =>
    formatDate(addDays(monday, index), { weekday: "short" }).replace(".", ""),
  );
}

function createDayButton(date, allEvents) {
  const key = toDateKey(date);
  const button = document.createElement("button");
  const todayKey = toDateKey(new Date());
  const today = todayKey === key;
  const past = key < todayKey;
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const hasExam = allEvents.some((event) => event.category === "exam");
  const hasHoliday = allEvents.some((event) => event.category === "holiday");

  button.type = "button";
  button.className = "day";
  if (weekend) {
    button.classList.add("day--weekend");
  } else if (hasExam) {
    button.classList.add("day--exam");
  } else if (hasHoliday) {
    button.classList.add("day--holiday");
  }
  if (past) button.classList.add("day--past");
  if (today) button.classList.add("day--today");

  const number = document.createElement("span");
  number.className = "day__number";
  number.textContent = String(date.getDate());
  button.append(number);

  const markers = document.createElement("span");
  markers.className = "day__events";
  const visibleEvents = eventsForDayDisplay(allEvents);
  const orderedEvents = orderEvents(visibleEvents);
  const markerEvents = orderedEvents.filter((event) => event.category !== "holiday");
  const shownEvents = markerEvents.slice(0, 2);

  for (const event of shownEvents) {
    const label = document.createElement("span");
    label.className = "day__event-label";
    label.style.setProperty("--event-color", eventColor(event.category));
    label.textContent = event.title;
    markers.append(label);
  }

  if (markerEvents.length > 2) {
    const more = document.createElement("span");
    more.className = "day__more";
    more.textContent = `+${markerEvents.length - 2}`;
    markers.append(more);
  }

  button.append(markers);

  const fullDate = formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const eventNames = orderedEvents.map((event) => event.title).join(", ");
  button.setAttribute("aria-label", eventNames ? `${fullDate}: ${eventNames}` : fullDate);
  button.title = eventNames ? `${fullDate} — ${eventNames}` : fullDate;
  button.addEventListener("click", () => openDayDialog(date, visibleEvents));
  return button;
}

function renderMonth(monthDate) {
  const article = document.createElement("article");
  article.className = "month-card";

  const header = document.createElement("header");
  header.className = "month-card__header";
  const title = document.createElement("h3");
  title.textContent = formatDate(monthDate, { month: "long", year: "numeric" });

  header.append(title);

  const weekdayRow = document.createElement("div");
  weekdayRow.className = "weekday-row";
  weekdayRow.setAttribute("aria-hidden", "true");
  for (const label of getWeekdayLabels()) {
    const cell = document.createElement("span");
    cell.textContent = label;
    weekdayRow.append(cell);
  }

  const daysGrid = document.createElement("div");
  daysGrid.className = "days-grid";
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - offset + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      const blank = document.createElement("span");
      blank.className = "day-blank";
      blank.setAttribute("aria-hidden", "true");
      daysGrid.append(blank);
      continue;
    }

    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber);
    daysGrid.append(createDayButton(date, state.eventsByDate.get(toDateKey(date)) || []));
  }

  article.append(header, weekdayRow, daysGrid);
  return article;
}

function renderCalendar() {
  elements.grid.replaceChildren();
  const fragment = document.createDocumentFragment();
  const months = monthSequence(state.calendar.startMonth, state.calendar.endMonth);
  const collapsePastMonths = isCurrentSchoolYear(state.calendar);
  const pastMonthCount = collapsePastMonths ? months.filter(isPastMonth).length : 0;

  elements.pastMonthsToggle.hidden = pastMonthCount === 0;
  elements.pastMonthsToggle.setAttribute("aria-expanded", String(state.showPastMonths));
  elements.pastMonthsToggle.textContent = state.showPastMonths
    ? "Hide past months"
    : "Show past months";

  for (const month of months) {
    if (collapsePastMonths && isPastMonth(month) && !state.showPastMonths) continue;
    fragment.append(renderMonth(month));
  }

  elements.grid.append(fragment);
  elements.grid.setAttribute("aria-busy", "false");
}

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";
  card.style.setProperty("--event-color", eventColor(event.category));

  const topline = document.createElement("div");
  topline.className = "event-card__topline";
  const title = document.createElement("h3");
  title.textContent = event.title;
  const category = document.createElement("span");
  category.className = "event-card__category";
  category.textContent = categoryLabel(event.category);
  topline.append(title, category);

  const range = document.createElement("p");
  range.className = "event-card__range";
  range.textContent = formatRange(event);
  card.append(topline, range);

  if (event.location && event.category !== "family" && event.category !== "exam") {
    const location = document.createElement("p");
    location.className = "event-card__meta";
    const strong = document.createElement("strong");
    strong.textContent = "Location: ";
    location.append(strong, document.createTextNode(event.location));
    card.append(location);
  }

  if (event.notes) {
    const notes = document.createElement("p");
    notes.className = "event-card__notes";
    notes.textContent = event.notes;
    card.append(notes);
  }

  if (event.url) {
    const link = document.createElement("a");
    link.className = "event-card__link";
    link.href = event.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = event.linkLabel || "More information ↗";
    card.append(link);
  }

  return card;
}

function openDayDialog(date, events) {
  elements.dialogDate.textContent = formatDate(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  elements.dialogEvents.replaceChildren();

  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "dialog-empty";
    empty.textContent = "Nothing planned for this day.";
    elements.dialogEvents.append(empty);
  } else {
    for (const event of orderEvents(events)) {
      elements.dialogEvents.append(createEventCard(event));
    }
  }

  elements.dialog.showModal();
}

async function loadYear(yearId) {
  const selected = state.manifest.years.find((year) => year.id === yearId) || state.manifest.years[0];
  elements.loading.hidden = false;
  elements.loading.textContent = "Loading calendar…";
  elements.grid.setAttribute("aria-busy", "true");

  const response = await fetch(selected.file, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${selected.file}.`);
  const calendar = await response.json();
  validateCalendar(calendar);

  state.calendar = calendar;
  state.eventsByDate = buildEventIndex(calendar.events);
  state.showPastMonths = false;
  elements.yearSelect.value = selected.id;
  elements.heroYear.textContent = calendar.label;
  elements.heading.textContent = `School Year ${calendar.label}`;
  document.title = `School Year ${calendar.label}`;
  renderCalendar();
  elements.loading.hidden = true;

  const url = new URL(window.location.href);
  url.searchParams.set("year", selected.id);
  window.history.replaceState({}, "", url);
}

async function init() {
  try {
    const response = await fetch("data/years.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load the school-year list.");
    state.manifest = await response.json();
    renderYearOptions();

    const requested = new URLSearchParams(window.location.search).get("year");
    const current = currentSchoolYearId();
    const initial = state.manifest.years.some((year) => year.id === requested)
      ? requested
      : state.manifest.years.some((year) => year.id === current)
        ? current
        : state.manifest.default || state.manifest.years[0].id;
    await loadYear(initial);
  } catch (error) {
    console.error(error);
    elements.loading.textContent =
      window.location.protocol === "file:"
        ? "This calendar reads its dates from JSON. Start a local web server in this folder with “python -m http.server 8000”, then open http://localhost:8000."
        : "The calendar could not be loaded. Please refresh the page or check the JSON files.";
    elements.loading.classList.add("error-state");
    elements.grid.setAttribute("aria-busy", "false");
  }
}

elements.yearSelect.addEventListener("change", () => loadYear(elements.yearSelect.value));
elements.pastMonthsToggle.addEventListener("click", () => {
  state.showPastMonths = !state.showPastMonths;
  renderCalendar();
});
elements.dialogClose.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

init();
