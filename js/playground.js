(function () {
  "use strict";

  var DB_NAME = "fun-corner-db";
  var DB_VERSION = 1;
  var STORE_PHOTOS = "photos";
  var LS_MESSAGES = "fun_corner_messages_v1";
  var MAX_PHOTOS = 16;
  var MAX_SIDE = 960;
  var JPEG_QUALITY = 0.82;
  var POLL_MS = 20000;

  /** Supabase publishable/secret keys are not JWTs — only send apikey; legacy anon JWT still uses Bearer. */
  function supabaseRestHeaders(key, withJsonBody) {
    var k = String(key || "");
    var h = { apikey: k, Accept: "application/json" };
    if (withJsonBody) {
      h["Content-Type"] = "application/json";
    }
    var isPlatformKey =
      k.indexOf("sb_publishable_") === 0 || k.indexOf("sb_secret_") === 0;
    if (!isPlatformKey) {
      h.Authorization = "Bearer " + k;
    }
    return h;
  }

  function getRemote() {
    var r = window.FUN_CORNER_REMOTE;
    if (!r || !r.supabaseUrl || !r.anonKey) return null;
    return {
      base: String(r.supabaseUrl).replace(/\/$/, ""),
      key: r.anonKey,
      table: r.messagesTable || "fc_messages",
    };
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = function () {
        reject(req.error);
      };
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          db.createObjectStore(STORE_PHOTOS, { keyPath: "id" });
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
    });
  }

  function idbGetAll(db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_PHOTOS, "readonly");
      var store = tx.objectStore(STORE_PHOTOS);
      var req = store.getAll();
      req.onerror = function () {
        reject(req.error);
      };
      req.onsuccess = function () {
        resolve(req.result || []);
      };
    });
  }

  function idbPut(db, record) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_PHOTOS, "readwrite");
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
      tx.objectStore(STORE_PHOTOS).put(record);
    });
  }

  function idbDelete(db, id) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_PHOTOS, "readwrite");
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
      tx.objectStore(STORE_PHOTOS).delete(id);
    });
  }

  function idbClear(db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_PHOTOS, "readwrite");
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
      tx.objectStore(STORE_PHOTOS).clear();
    });
  }

  function resizeToJpegBlob(file, callback) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      var scale = Math.min(1, MAX_SIDE / Math.max(w, h, 1));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        callback(null);
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(
        function (blob) {
          callback(blob);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      callback(null);
    };
    img.src = url;
  }

  function loadLocalMessages() {
    try {
      var raw = localStorage.getItem(LS_MESSAGES);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalMessages(list) {
    try {
      localStorage.setItem(LS_MESSAGES, JSON.stringify(list));
    } catch (e) {
      /* quota exceeded — trim oldest */
      if (list.length > 1) {
        saveLocalMessages(list.slice(-Math.floor(list.length / 2)));
      }
    }
  }

  function sanitizeName(s) {
    return String(s || "")
      .trim()
      .slice(0, 24)
      .replace(/[\u0000-\u001F]/g, "");
  }

  function sanitizeMessage(s) {
    return String(s || "")
      .trim()
      .slice(0, 500)
      .replace(/[\u0000-\u001F]/g, "");
  }

  function initGallery() {
    var input = document.getElementById("gallery-input");
    var grid = document.getElementById("gallery-grid");
    var clearBtn = document.getElementById("gallery-clear-all");
    var hint = document.getElementById("gallery-hint");
    if (!input || !grid) return;

    var objectUrls = [];

    function revokeAllUrls() {
      for (var i = 0; i < objectUrls.length; i++) {
        URL.revokeObjectURL(objectUrls[i]);
      }
      objectUrls = [];
    }

    function render(rows) {
      revokeAllUrls();
      grid.innerHTML = "";
      for (var i = 0; i < rows.length; i++) {
        (function (row) {
          var wrap = document.createElement("div");
          wrap.className = "gallery-item";
          var img = document.createElement("img");
          var u = URL.createObjectURL(row.blob);
          objectUrls.push(u);
          img.src = u;
          img.alt = "Uploaded picture";
          img.loading = "lazy";
          var del = document.createElement("button");
          del.type = "button";
          del.className = "gallery-remove";
          del.setAttribute("aria-label", "Remove this picture");
          del.textContent = "×";
          del.addEventListener("click", function () {
            openDb()
              .then(function (db) {
                return idbDelete(db, row.id);
              })
              .then(function () {
                return openDb().then(idbGetAll);
              })
              .then(render)
              .catch(function () {});
          });
          wrap.appendChild(img);
          wrap.appendChild(del);
          grid.appendChild(wrap);
        })(rows[i]);
      }
      if (hint) {
        hint.textContent =
          rows.length === 0
            ? "No pictures yet — add one! They stay on this device."
            : rows.length +
              " picture" +
              (rows.length === 1 ? "" : "s") +
              " saved on this device.";
      }
    }

    openDb()
      .then(idbGetAll)
      .then(render)
      .catch(function () {
        if (hint) hint.textContent = "Could not open storage. Check browser settings.";
      });

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      input.value = "";
      if (!file || !file.type || file.type.indexOf("image/") !== 0) return;

      openDb()
        .then(idbGetAll)
        .then(function (existing) {
          if (existing.length >= MAX_PHOTOS) {
            if (hint) hint.textContent = "Gallery is full (" + MAX_PHOTOS + " max). Remove one first.";
            return Promise.reject(new Error("full"));
          }
          return new Promise(function (resolve) {
            resizeToJpegBlob(file, resolve);
          }).then(function (blob) {
            if (!blob) {
              if (hint) hint.textContent = "Could not read that image. Try another file.";
              return Promise.reject(new Error("bad"));
            }
            var id =
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : "p-" + Date.now() + "-" + Math.random().toString(16).slice(2);
            return openDb().then(function (db) {
              return idbPut(db, { id: id, blob: blob, createdAt: Date.now() });
            });
          });
        })
        .then(function () {
          return openDb().then(idbGetAll);
        })
        .then(render)
        .catch(function (err) {
          if (err && err.message === "full") return;
          if (err && err.message === "bad") return;
        });
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!window.confirm("Remove every picture from this device?")) return;
        openDb()
          .then(idbClear)
          .then(function () {
            return openDb().then(idbGetAll);
          })
          .then(render)
          .catch(function () {});
      });
    }
  }

  function renderChatLog(logEl, messages, localUser) {
    logEl.innerHTML = "";
    var sorted = messages.slice().sort(function (a, b) {
      return (a.ts || 0) - (b.ts || 0);
    });
    for (var i = 0; i < sorted.length; i++) {
      var m = sorted[i];
      var row = document.createElement("div");
      row.className = "chat-bubble-wrap";
      var mine =
        localUser &&
        m.author &&
        sanitizeName(localUser).toLowerCase() === sanitizeName(m.author).toLowerCase();
      if (mine) row.classList.add("chat-bubble-wrap--mine");
      var meta = document.createElement("div");
      meta.className = "chat-meta";
      meta.textContent = (m.author || "Friend") + (m.ts ? " · " + formatTime(m.ts) : "");
      var bubble = document.createElement("div");
      bubble.className = "chat-bubble";
      bubble.textContent = m.text || "";
      row.appendChild(meta);
      row.appendChild(bubble);
      logEl.appendChild(row);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function formatTime(ts) {
    try {
      var d = new Date(ts);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function mapRemoteRows(rows) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var ts = r.created_at ? Date.parse(r.created_at) : Date.now();
      out.push({
        id: r.id,
        author: sanitizeName(r.author),
        text: sanitizeMessage(r.body),
        ts: ts,
        remote: true,
      });
    }
    return out;
  }

  function initWall() {
    var logEl = document.getElementById("chat-log");
    var nameEl = document.getElementById("chat-name");
    var msgEl = document.getElementById("chat-msg");
    var sendBtn = document.getElementById("chat-send");
    var statusEl = document.getElementById("remote-status");
    if (!logEl || !nameEl || !msgEl || !sendBtn) return;

    var remote = getRemote();
    var pollTimer = null;
    var cache = [];

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text;
    }

    function mergeRemote(remoteRows) {
      var local = loadLocalMessages();
      var byKey = {};
      for (var i = 0; i < local.length; i++) {
        byKey["l-" + local[i].id] = local[i];
      }
      for (var j = 0; j < remoteRows.length; j++) {
        byKey["r-" + remoteRows[j].id] = remoteRows[j];
      }
      var merged = [];
      for (var k in byKey) {
        if (Object.prototype.hasOwnProperty.call(byKey, k)) {
          merged.push(byKey[k]);
        }
      }
      return merged;
    }

    function refreshView() {
      var name = nameEl.value;
      renderChatLog(logEl, cache, name);
    }

    function fetchRemote() {
      if (!remote) return Promise.resolve();
      var url =
        remote.base +
        "/rest/v1/" +
        encodeURIComponent(remote.table) +
        "?select=id,author,body,created_at&order=created_at.asc&limit=100";
      return fetch(url, {
        headers: supabaseRestHeaders(remote.key, false),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("fetch failed");
          return res.json();
        })
        .then(function (rows) {
          var mapped = mapRemoteRows(Array.isArray(rows) ? rows : []);
          cache = mergeRemote(mapped);
          refreshView();
          setStatus("Shared wall: messages sync for everyone with this page (see README for setup).");
        })
        .catch(function () {
          setStatus("Could not reach shared wall. Showing this device only.");
          cache = loadLocalMessages();
          refreshView();
        });
    }

    function postRemote(author, text) {
      if (!remote) return Promise.reject(new Error("no remote"));
      var url = remote.base + "/rest/v1/" + encodeURIComponent(remote.table);
      var postHeaders = supabaseRestHeaders(remote.key, true);
      postHeaders.Prefer = "return=minimal";
      return fetch(url, {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify({ author: author, body: text }),
      }).then(function (res) {
        if (!res.ok) throw new Error("post failed");
      });
    }

    function send() {
      var author = sanitizeName(nameEl.value);
      var text = sanitizeMessage(msgEl.value);
      if (!author) {
        setStatus("Pick a name so friends know who wrote the note.");
        nameEl.focus();
        return;
      }
      if (!text) {
        msgEl.focus();
        return;
      }

      var entry = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "m-" + Date.now(),
        author: author,
        text: text,
        ts: Date.now(),
      };

      if (remote) {
        postRemote(author, text)
          .then(function () {
            msgEl.value = "";
            return fetchRemote();
          })
          .catch(function () {
            setStatus("Send failed. Check Supabase setup or try again.");
          });
        return;
      }

      var list = loadLocalMessages();
      list.push(entry);
      saveLocalMessages(list);
      cache = list;
      msgEl.value = "";
      refreshView();
      setStatus("Saved on this device only — friends on other phones or computers will not see it.");
    }

    sendBtn.addEventListener("click", send);
    msgEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        send();
      }
    });

    if (remote) {
      setStatus("Loading shared messages…");
      fetchRemote();
      pollTimer = window.setInterval(fetchRemote, POLL_MS);
    } else {
      cache = loadLocalMessages();
      refreshView();
      setStatus(
        "This device only — notes stay in this browser. A grown-up can turn on optional sharing (README)."
      );
    }

    window.addEventListener(
      "beforeunload",
      function () {
        if (pollTimer) window.clearInterval(pollTimer);
      },
      { once: true }
    );
  }

  function initPlayground() {
    initGallery();
    initWall();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayground);
  } else {
    initPlayground();
  }
})();
