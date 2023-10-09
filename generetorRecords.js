const DB_NAME = "store";
const QUANTITY_RECORDS = 10000000;
const QUANTITY_SYMBOLS = 100;
const BATCH_SIZE = 1000;

let db = null;
let isFilling = false;

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  setupDb();
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.action === "generateRecords")
    setupDb().then(generateRecords);
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/getRecords")) {
    const url = new URL(event.request.url);
    let searchQuery = url.searchParams.get("searchQuery");
    let offset = Number(url.searchParams.get("offset"));
    let limit = url.searchParams.get("limit");

    if (searchQuery === null) searchQuery = "";
    if (limit === null || limit > 10000) limit = 20;
    event.respondWith(
      new Promise((resolve) => {
        return searchData(
          (searchQuery = searchQuery),
          (offset = offset),
          (limit = 20)
        ).then((data) => {
          resolve(
            new Response(JSON.stringify(data), {
              headers: {
                "Content-Type": "application/json",
              },
            })
          );
        });
      })
    );
  }
});

function searchData(searchQuery, offset, limit) {
  return new Promise((resolve, reject) => {
    let transaction = db.transaction(DB_NAME, "readonly");
    let store = transaction.objectStore(DB_NAME);
    let dataIndex = store.index("data_idx");
    let request = dataIndex.openCursor(
      IDBKeyRange.bound(searchQuery, searchQuery + "\uffff", false, false)
    );
    let searchData = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) return resolve([0, searchData]);
      if (searchData.length === limit) return resolve([1, searchData]);
      if (offset !== 0) {
        let advanceCount = offset;
        offset = 0;
        cursor.advance(advanceCount);
        return;
      }
      searchData.push(cursor.value);
      cursor.continue();
    };
    request.onerror = reject;
  });
}

function setupDb() {
  return new Promise((resolve, reject) => {
    if (db) return resolve();
    let openRequest = indexedDB.open(DB_NAME, 1);

    openRequest.onerror = (event) => {
      sendMessage({
        type: "error_connect_db",
        message: "Ошибка подключения к бд",
      });
      reject();
    };
    openRequest.onupgradeneeded = (e) => {
      db = openRequest.result;
      if (!db.objectStoreNames.contains(DB_NAME)) {
        let store = db.createObjectStore(DB_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("data_idx", "data");
      }
      e.target.transaction.oncomplete = resolve;
    };
    openRequest.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };
  });
}

function sendMessage(message) {
  self.clients.matchAll().then(function (clients) {
    clients.forEach(function (client) {
      client.postMessage({
        message: message,
      });
    });
  });
}

function generateRecords() {
  if (!db) {
    sendMessage({
      type: "db_not_ready",
      message: "База данных еще не готова!",
    });
    return;
  }
  if (isFilling) {
    sendMessage({
      type: "db_already_filling",
      message: "База данных уже заполняется!",
    });
    return;
  }
  sendMessage({
    type: "start_clear_db",
    message: "Запуск очистки базы данных!",
  });
  isFilling = true;
  clearDb()
    .then(() => {
      sendMessage({
        type: "db_start_fill",
        message: "Запуск заполнения базы данных",
      });
      sendMessage({
        type: "fill_progress",
        percent: 0,
        message: `Прогресс заполнения базы данных --> ${0}`,
      });
      fillDb()
        .then(() => {
          isFilling = false;
          sendMessage({
            type: "end_fill_data",
            message: "Успешное завершение заполнение базы данных!",
          });
        })
        .catch((e) => {
          isFilling = false;
          sendMessage({
            type: "error_fill_db",
            message: `Ошибка заполнения бд по причине --> ${e}`,
          });
        });
    })
    .catch(() => {
      isFilling = false;
      sendMessage({
        type: "error_clear_db",
        message: "Ошибка очистки базы данных!",
      });
    });
}

function clearDb() {
  return new Promise((resolve, reject) => {
    let transaction = db.transaction(DB_NAME, "readwrite");
    transaction.objectStore(DB_NAME).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = reject;
  });
}

function fillDb(currentRecords = 0) {
  return new Promise((resolve, reject) => {
    let transaction = db.transaction(DB_NAME, "readwrite");
    let store = transaction.objectStore(DB_NAME);
    transaction.oncomplete = function (event) {
      currentRecords += BATCH_SIZE;
      let percentProgress = (100 * currentRecords) / QUANTITY_RECORDS;
      sendMessage({
        type: "fill_progress",
        percent: percentProgress,
        message: `Прогресс заполнения базы данных --> ${percentProgress}`,
      });
      if (currentRecords < QUANTITY_RECORDS)
        fillDb(currentRecords).then(resolve);
      else resolve();
    };
    for (let i = 0; i < BATCH_SIZE; i++) {
      store.add({
        data: generateRandomString(QUANTITY_SYMBOLS),
      });
    }
  });
}

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    {
      length,
    },
    () => characters[Math.floor(Math.random() * characters.length)]
  ).join("");
}
