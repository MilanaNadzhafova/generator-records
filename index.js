const LIMIT_RECORDS = 10;

let searchInput = null;
let progress = null;
let progressBar = null;
let progressText = null;
let containerRecordsDiv = null;
let listRecordsDiv = null;
let prevBtn = null;
let nextBtn = null;
let notificationText = null;
let showNotificationButton = null;
let closeNotificationButton = null;
let notification = null;
let notificationTimoutId = null;
let delaySearchId = null;

function delaySearch(func, delay = 400) {
  if (delaySearchId) clearTimeout(delaySearchId);
  delaySearchId = setTimeout(func, delay);
}

document.addEventListener("DOMContentLoaded", function () {
  searchInput = document.querySelector("#search");
  progressBar = document.querySelector("#progress");
  progress = document.querySelector("#progress-bar");
  progressText = document.querySelector("#progress-text");
  containerRecordsDiv = document.querySelector("#container-records");
  listRecordsDiv = document.querySelector("#list-records");
  prevBtn = document.querySelector("#prevBtn");
  nextBtn = document.querySelector("#nextBtn");
  notificationText = document.getElementById("notificationText");
  showNotificationButton = document.getElementById("showNotification");
  closeNotificationButton = document.getElementById("closeNotification");
  notification = document.getElementById("notification");

  searchInput.addEventListener("input", () => {
    listRecordsDiv.setAttribute("data-offset", 0);
    delaySearch(fillSearchData);
  });
  prevBtn.addEventListener("click", () => {
    let offset =
      Number(listRecordsDiv.getAttribute("data-offset")) - LIMIT_RECORDS;
    listRecordsDiv.setAttribute("data-offset", offset);
    if (offset === 0) prevBtn.disabled = true;
    fillSearchData();
  });
  nextBtn.addEventListener("click", () => {
    prevBtn.disabled = false;
    listRecordsDiv.setAttribute(
      "data-offset",
      Number(listRecordsDiv.getAttribute("data-offset")) + LIMIT_RECORDS
    );
    fillSearchData();
  });
});

if (navigator.serviceWorker.controller) {
  console.log(
    "Аквтивация Service Worker не требуется, найдена активная версия"
  );
  navigator.serviceWorker.addEventListener("message", function (event) {
    processMessageSW(event.data.message);
  });
} else {
  navigator.serviceWorker
    .register("generetorRecords.js", {
      scope: "/",
    })
    .then(function (registration) {
      console.log("Service Worker зарегистрирован:", registration);
      navigator.serviceWorker.addEventListener("message", function (event) {
        processMessageSW(event.data.message);
      });
    })
    .catch(function (error) {
      // Произошла ошибка при регистрации Service Worker
      console.error("Ошибка регистрации Service Worker:", error);
    });
}

function showNotification(text) {
  closeNotification();
  notification.style.display = "block";
  notificationText.textContent = text;
  notificationTimoutId = setTimeout(() => {
    closeNotification();
  }, 2000);
}

function closeNotification(text) {
  if (notificationTimoutId) clearTimeout(notificationTimoutId);
  notification.style.display = "none";
  notificationText.textContent = "";
}

function isActiveServiceWorker() {
  return Boolean(navigator.serviceWorker.controller);
}

function generateRecords() {
  if (!isActiveServiceWorker()) {
    showNotification("Service Worker не зарегистрирован!");
    return;
  }

  progress.style = "display: flex;";

  navigator.serviceWorker.controller.postMessage({
    action: "generateRecords",
  });
}

function getRecords(searchQuery, offset, limit) {
  return new Promise((resolve) => {
    fetch(
      `/getRecords?searchQuery=${searchQuery}&offset=${offset}&limit=${limit}`
    )
      .then((response) => response.json())
      .then((data) => resolve(data));
  });
}

function fillSearchData() {
  containerRecordsDiv.style = "visibility:hidden;";
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  getRecords(
    (searchQuery = searchInput.value),
    listRecordsDiv.getAttribute("data-offset"),
    (limit = LIMIT_RECORDS)
  ).then((data) => {
    let [hasNextValue, dataSearch] = data;
    listRecordsDiv.setAttribute("data-hasNext", hasNextValue);
    if (hasNextValue) nextBtn.disabled = false;
    else nextBtn.disabled = true;
    if (Number(listRecordsDiv.getAttribute("data-offset")) !== 0)
      prevBtn.disabled = false;
    let htmlItems = "";
    dataSearch.forEach((element) => {
      htmlItems += `<li class="generator-records__record">${element.data}</li>\n`;
    });
    if (htmlItems === "")
      listRecordsDiv.innerHTML = "Не найдено ни одной записи!";
    else listRecordsDiv.innerHTML = htmlItems;
    containerRecordsDiv.style = "visibility:visible;";
  });
}

function fillProgress(percent) {
  progress.style = "display: flex;";
  progressText.innerHTML = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function processMessageSW(message) {
  if (message.type === "error_connect_db")
    showNotification("Ошибка подключения к базы данных из SW");
  else if (message.type === "db_not_ready")
    showNotification("Подключение к базы данных еще не готово");
  else if (message.type === "db_start_fill")
    showNotification("Запуск заполнения базы данных");
  else if (message.type === "end_fill_data")
    showNotification("Заполнение базы данных успешно завершено");
  else if (message.type === "db_already_filling")
    showNotification("База данных уже заполняется! Подождите!");
  else if (message.type === "error_fill_db")
    showNotification("Ошибка заполнения базы данных!");
  else if (message.type === "start_clear_db")
    showNotification("Запуск очистки базы данных");
  else if (message.type === "fill_progress") fillProgress(message.percent);
}
