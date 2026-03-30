(function () {
  "use strict";

  var MAX_PHOTOS = 16;
  var MAX_SIDE = 960;
  var JPEG_QUALITY = 0.82;
  var POLL_MS = 20000;

  /** Publishable/secret keys: apikey only. Legacy anon JWT: also Bearer. */
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

  function supabaseBinaryHeaders(key, contentType) {
    var k = String(key || "");
    var h = {
      apikey: k,
      "Content-Type": contentType || "application/octet-stream",
    };
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
      bucket: r.photosBucket || "fc-photos",
    };
  }

  function storagePublicUrl(remote, objectName) {
    return (
      remote.base +
      "/storage/v1/object/public/" +
      encodeURIComponent(remote.bucket) +
      "/" +
      encodeURIComponent(objectName)
    );
  }

  function storageList(remote) {
    var url =
      remote.base +
      "/storage/v1/object/list/" +
      encodeURIComponent(remote.bucket);
    return fetch(url, {
      method: "POST",
      headers: supabaseRestHeaders(remote.key, true),
      body: JSON.stringify({
        prefix: "",
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "desc" },
      }),
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error("list failed"));
      return res.json();
    });
  }

  function storageUpload(remote, objectName, blob) {
    var url =
      remote.base +
      "/storage/v1/object/" +
      encodeURIComponent(remote.bucket) +
      "/" +
      encodeURIComponent(objectName);
    return fetch(url, {
      method: "POST",
      headers: supabaseBinaryHeaders(remote.key, "image/jpeg"),
      body: blob,
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error("upload failed"));
    });
  }

  function storageDelete(remote, objectName) {
    var url =
      remote.base +
      "/storage/v1/object/" +
      encodeURIComponent(remote.bucket) +
      "/" +
      encodeURIComponent(objectName);
    return fetch(url, {
      method: "DELETE",
      headers: supabaseRestHeaders(remote.key, false),
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error("delete failed"));
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
    var label = document.querySelector('label[for="gallery-input"]');
    if (!input || !grid) return;

    var remote = getRemote();

    function setDisabled(on) {
      input.disabled = on;
      if (label) {
        label.classList.toggle("is-disabled", on);
        label.setAttribute("aria-disabled", on ? "true" : "false");
      }
      if (clearBtn) clearBtn.disabled = on;
    }

    function render(names) {
      grid.innerHTML = "";
      if (!remote) return;
      for (var i = 0; i < names.length; i++) {
        (function (name) {
          var wrap = document.createElement("div");
          wrap.className = "gallery-item";
          var img = document.createElement("img");
          img.src = storagePublicUrl(remote, name);
          img.alt = "Shared picture";
          img.loading = "lazy";
          var del = document.createElement("button");
          del.type = "button";
          del.className = "gallery-remove";
          del.setAttribute("aria-label", "Remove this picture");
          del.textContent = "×";
          del.addEventListener("click", function () {
            storageDelete(remote, name)
              .then(function () {
                return storageList(remote);
              })
              .then(function (rows) {
                render(fileNamesFromList(rows));
                updateHint(fileNamesFromList(rows).length);
              })
              .catch(function () {
                if (hint) hint.textContent = "Could not delete. Check Storage policies in Supabase.";
              });
          });
          wrap.appendChild(img);
          wrap.appendChild(del);
          grid.appendChild(wrap);
        })(names[i]);
      }
    }

    function fileNamesFromList(rows) {
      if (!Array.isArray(rows)) return [];
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var n = rows[i] && rows[i].name;
        if (n && n.indexOf("/") === -1 && /\.jpe?g$/i.test(n)) out.push(n);
      }
      return out;
    }

    function updateHint(count) {
      if (!hint) return;
      if (!remote) {
        hint.textContent =
          "Configure js/community-config.js with your Supabase URL and key to use the cloud gallery.";
        return;
      }
      hint.textContent =
        count === 0
          ? "No pictures yet — add one! Stored in your Supabase bucket (" + remote.bucket + ")."
          : count +
            " picture" +
            (count === 1 ? "" : "s") +
            " in Supabase — visible to everyone who visits this site.";
    }

    function refresh() {
      if (!remote) {
        updateHint(0);
        setDisabled(true);
        return;
      }
      setDisabled(false);
      if (hint) hint.textContent = "Loading pictures…";
      storageList(remote)
        .then(function (rows) {
          var names = fileNamesFromList(rows);
          render(names);
          updateHint(names.length);
        })
        .catch(function () {
          if (hint) {
            hint.textContent =
              "Could not load pictures. Create bucket " +
              remote.bucket +
              " and Storage policies (see README).";
          }
          render([]);
        });
    }

    refresh();

    input.addEventListener("change", function () {
      if (!remote) return;
      var file = input.files && input.files[0];
      input.value = "";
      if (!file || !file.type || file.type.indexOf("image/") !== 0) return;

      storageList(remote)
        .then(function (rows) {
          var names = fileNamesFromList(rows);
          if (names.length >= MAX_PHOTOS) {
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
            var objectName =
              (typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : "p-" + Date.now() + "-" + Math.random().toString(16).slice(2)) + ".jpg";
            return storageUpload(remote, objectName, blob);
          });
        })
        .then(function () {
          return storageList(remote);
        })
        .then(function (rows) {
          var names = fileNamesFromList(rows);
          render(names);
          updateHint(names.length);
        })
        .catch(function (err) {
          if (err && err.message === "full") return;
          if (err && err.message === "bad") return;
          if (hint) hint.textContent = "Upload failed. Check Storage bucket and insert policy in Supabase.";
        });
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!remote) return;
        if (!window.confirm("Remove every picture from Supabase for this site?")) return;
        storageList(remote)
          .then(function (rows) {
            var names = fileNamesFromList(rows);
            var chain = Promise.resolve();
            for (var i = 0; i < names.length; i++) {
              (function (n) {
                chain = chain.then(function () {
                  return storageDelete(remote, n);
                });
              })(names[i]);
            }
            return chain;
          })
          .then(function () {
            return refresh();
          })
          .catch(function () {
            if (hint) hint.textContent = "Could not remove all. Check delete policy on storage.objects.";
          });
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
          cache = mapRemoteRows(Array.isArray(rows) ? rows : []);
          refreshView();
          setStatus("Messages load from Supabase and sync for everyone who visits this page.");
        })
        .catch(function () {
          setStatus("Could not load messages. Check fc_messages table and RLS in Supabase.");
          cache = [];
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
      if (!remote) {
        setStatus("Add your Supabase URL and key in js/community-config.js to send messages.");
        return;
      }
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

      postRemote(author, text)
        .then(function () {
          msgEl.value = "";
          return fetchRemote();
        })
        .catch(function () {
          setStatus("Send failed. Check Supabase table and insert policy.");
        });
    }

    sendBtn.addEventListener("click", send);
    msgEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        send();
      }
    });

    if (remote) {
      nameEl.disabled = false;
      msgEl.disabled = false;
      sendBtn.disabled = false;
      setStatus("Loading messages…");
      fetchRemote();
      pollTimer = window.setInterval(fetchRemote, POLL_MS);
    } else {
      cache = [];
      refreshView();
      nameEl.disabled = true;
      msgEl.disabled = true;
      sendBtn.disabled = true;
      setStatus("Set js/community-config.js with Supabase URL and key to use the message wall.");
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
