(function () {
  "use strict";

  var MAX_PHOTOS = 16;
  var MAX_SIDE = 960;
  var JPEG_QUALITY = 0.82;
  var POLL_MS = 20000;
  var SESSION_KEY = "fun_corner_owner_session";
  var VOTER_KEY = "fun_corner_voter_id";

  function isPlatformKey(k) {
    return (
      k.indexOf("sb_publishable_") === 0 || k.indexOf("sb_secret_") === 0
    );
  }

  /** userAccessToken: owner JWT for Storage write; omit for anon read */
  function supabaseRestHeaders(key, withJsonBody, userAccessToken) {
    var k = String(key || "");
    var h = { apikey: k, Accept: "application/json" };
    if (withJsonBody) {
      h["Content-Type"] = "application/json";
    }
    if (userAccessToken) {
      h.Authorization = "Bearer " + userAccessToken;
    } else if (!isPlatformKey(k)) {
      h.Authorization = "Bearer " + k;
    }
    return h;
  }

  function supabaseBinaryHeaders(key, contentType, userAccessToken) {
    var k = String(key || "");
    var h = { apikey: k, "Content-Type": contentType || "application/octet-stream" };
    if (userAccessToken) {
      h.Authorization = "Bearer " + userAccessToken;
    } else if (!isPlatformKey(k)) {
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
      commentsTable: r.commentsTable || "fc_photo_comments",
      photoLikesTable: r.photoLikesTable || "fc_photo_likes",
      commentLikesTable: r.commentLikesTable || "fc_comment_likes",
    };
  }

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function saveSession(data) {
    var expMs = (data.expires_in || 3600) * 1000;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + expMs,
        user: data.user,
      })
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isOwnerLoggedIn() {
    var s = loadSession();
    return !!(s && s.access_token && Date.now() < (s.expires_at || 0) - 10000);
  }

  function ensureAccessToken(remote) {
    var s = loadSession();
    if (!s || !s.access_token) return Promise.resolve(null);
    if (Date.now() < (s.expires_at || 0) - 60000) {
      return Promise.resolve(s.access_token);
    }
    if (!s.refresh_token) {
      clearSession();
      return Promise.resolve(null);
    }
    return fetch(remote.base + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: supabaseRestHeaders(remote.key, true),
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("refresh failed");
        return res.json();
      })
      .then(function (data) {
        saveSession(data);
        return data.access_token;
      })
      .catch(function () {
        clearSession();
        return null;
      });
  }

  function authSignIn(remote, email, password) {
    return fetch(remote.base + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: supabaseRestHeaders(remote.key, true),
      body: JSON.stringify({ email: email.trim(), password: password }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var msg =
              body.msg ||
              body.error_description ||
              body.message ||
              "Sign-in failed";
            throw new Error(msg);
          }
          return body;
        });
      })
      .then(function (data) {
        saveSession(data);
        return data;
      });
  }

  function getOrCreateVoterId() {
    try {
      var v = localStorage.getItem(VOTER_KEY);
      if (v) return v;
      v =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "v-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      localStorage.setItem(VOTER_KEY, v);
      return v;
    } catch (e) {
      return "v-fallback";
    }
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

  function storageUpload(remote, objectName, blob, accessToken) {
    if (!accessToken) return Promise.reject(new Error("no token"));
    var url =
      remote.base +
      "/storage/v1/object/" +
      encodeURIComponent(remote.bucket) +
      "/" +
      encodeURIComponent(objectName);
    return fetch(url, {
      method: "POST",
      headers: supabaseBinaryHeaders(remote.key, "image/jpeg", accessToken),
      body: blob,
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error("upload failed"));
    });
  }

  function storageDelete(remote, objectName, accessToken) {
    if (!accessToken) return Promise.reject(new Error("no token"));
    var url =
      remote.base +
      "/storage/v1/object/" +
      encodeURIComponent(remote.bucket) +
      "/" +
      encodeURIComponent(objectName);
    return fetch(url, {
      method: "DELETE",
      headers: supabaseRestHeaders(remote.key, false, accessToken),
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error("delete failed"));
    });
  }

  function restDelete(remote, table, filter) {
    var url =
      remote.base +
      "/rest/v1/" +
      encodeURIComponent(table) +
      "?" +
      filter;
    return fetch(url, {
      method: "DELETE",
      headers: supabaseRestHeaders(remote.key, false),
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error("delete failed"));
    });
  }

  function restGet(remote, pathWithQuery) {
    return fetch(remote.base + "/rest/v1/" + pathWithQuery, {
      headers: supabaseRestHeaders(remote.key, false),
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error("get failed"));
      return res.json();
    });
  }

  function restPost(remote, table, row) {
    var url = remote.base + "/rest/v1/" + encodeURIComponent(table);
    var h = supabaseRestHeaders(remote.key, true);
    h.Prefer = "return=minimal";
    return fetch(url, {
      method: "POST",
      headers: h,
      body: JSON.stringify(row),
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error("post failed"));
    });
  }

  /**
   * Never upload the original file. Decode to pixels only, then write a new JPEG.
   * That drops EXIF, GPS, IPTC, XMP, thumbnails, and other embedded metadata typical
   * in phone/camera images. Filename is not sent (server uses a random .jpg name).
   */
  function stripMetadataAndEncodeJpeg(file, callback) {
    function encodeFromDimensions(spec) {
      var w = spec.width;
      var h = spec.height;
      var scale = Math.min(1, MAX_SIDE / Math.max(w, h, 1));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        callback(null);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      spec.paint(ctx, cw, ch);
      canvas.toBlob(
        function (blob) {
          canvas.width = 0;
          canvas.height = 0;
          callback(blob);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    }

    if (typeof createImageBitmap === "function") {
      createImageBitmap(file, { imageOrientation: "from-image" })
        .then(function (bitmap) {
          try {
            encodeFromDimensions({
              width: bitmap.width,
              height: bitmap.height,
              paint: function (ctx, cw, ch) {
                ctx.drawImage(bitmap, 0, 0, cw, ch);
              },
            });
          } finally {
            try {
              bitmap.close();
            } catch (e) {
              /* ignore */
            }
          }
        })
        .catch(function () {
          stripMetadataWithImageElement(file, callback);
        });
      return;
    }

    stripMetadataWithImageElement(file, callback);
  }

  function stripMetadataWithImageElement(file, callback) {
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
      var ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        callback(null);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(
        function (blob) {
          canvas.width = 0;
          canvas.height = 0;
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

  function fileNamesFromList(rows) {
    if (!Array.isArray(rows)) return [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var n = rows[i] && rows[i].name;
      if (n && n.indexOf("/") === -1 && /\.jpe?g$/i.test(n)) out.push(n);
    }
    return out;
  }

  function initOwnerAuth(remote, onAuthChange) {
    var emailEl = document.getElementById("owner-email");
    var passEl = document.getElementById("owner-password");
    var signInBtn = document.getElementById("owner-signin");
    var signOutBtn = document.getElementById("owner-signout");
    var statusEl = document.getElementById("owner-auth-status");
    if (!remote || !signInBtn || !signOutBtn) return;

    function setStatus(t) {
      if (statusEl) statusEl.textContent = t;
    }

    function updateUi() {
      var on = isOwnerLoggedIn();
      if (emailEl) emailEl.disabled = on;
      if (passEl) passEl.disabled = on;
      signInBtn.style.display = on ? "none" : "inline-flex";
      signOutBtn.style.display = on ? "inline-flex" : "none";
      if (on) {
        var s = loadSession();
        var em = (s && s.user && s.user.email) || "Owner";
        setStatus("Signed in as " + em + " — you can upload and delete photos.");
      } else {
        setStatus("Sign in with your owner account to add or remove pictures. Visitors can only view.");
      }
    }

    signInBtn.addEventListener("click", function () {
      var email = emailEl ? emailEl.value : "";
      var password = passEl ? passEl.value : "";
      if (!email || !password) {
        setStatus("Enter email and password.");
        return;
      }
      setStatus("Signing in…");
      authSignIn(remote, email, password)
        .then(function () {
          if (passEl) passEl.value = "";
          updateUi();
          if (onAuthChange) onAuthChange();
        })
        .catch(function (err) {
          setStatus(err.message || "Sign-in failed.");
        });
    });

    signOutBtn.addEventListener("click", function () {
      clearSession();
      updateUi();
      if (onAuthChange) onAuthChange();
    });

    updateUi();
  }

  /** Comments + comment_likes cascade in DB; then photo-level likes. */
  function deletePhotoRelatedData(remote, photoKey) {
    var enc = encodeURIComponent(photoKey);
    return restDelete(
      remote,
      remote.commentsTable,
      "photo_key=eq." + enc
    ).then(function () {
      return restDelete(
        remote,
        remote.photoLikesTable,
        "photo_key=eq." + enc
      );
    });
  }

  function initGallery(remote) {
    var input = document.getElementById("gallery-input");
    var grid = document.getElementById("gallery-grid");
    var clearBtn = document.getElementById("gallery-clear-all");
    var hint = document.getElementById("gallery-hint");
    var label = document.querySelector('label[for="gallery-input"]');
    if (!input || !grid) return;

    var voterId = getOrCreateVoterId();

    function setToolbarDisabled(on) {
      input.disabled = on;
      if (label) {
        label.classList.toggle("is-disabled", on);
        label.setAttribute("aria-disabled", on ? "true" : "false");
      }
      if (clearBtn) clearBtn.disabled = on;
    }

    function updateToolbar() {
      if (!remote) {
        setToolbarDisabled(true);
        return;
      }
      var owner = isOwnerLoggedIn();
      setToolbarDisabled(!owner);
    }

    function fetchPhotoLikeCount(photoKey) {
      return restGet(
        remote,
        encodeURIComponent(remote.photoLikesTable) +
          "?select=id&photo_key=eq." +
          encodeURIComponent(photoKey)
      ).then(function (rows) {
        return Array.isArray(rows) ? rows.length : 0;
      });
    }

    function fetchUserPhotoLike(photoKey) {
      return restGet(
        remote,
        encodeURIComponent(remote.photoLikesTable) +
          "?select=id&photo_key=eq." +
          encodeURIComponent(photoKey) +
          "&voter_id=eq." +
          encodeURIComponent(voterId)
      ).then(function (rows) {
        return Array.isArray(rows) && rows[0] ? rows[0].id : null;
      });
    }

    function togglePhotoLike(photoKey, likeBtn, countEl) {
      fetchUserPhotoLike(photoKey).then(function (likeId) {
        if (likeId) {
          restDelete(
            remote,
            remote.photoLikesTable,
            "id=eq." + encodeURIComponent(likeId)
          )
            .then(function () {
              return fetchPhotoLikeCount(photoKey);
            })
            .then(function (n) {
              countEl.textContent = String(n);
              likeBtn.setAttribute("aria-pressed", "false");
            })
            .catch(function () {});
        } else {
          restPost(remote, remote.photoLikesTable, {
            photo_key: photoKey,
            voter_id: voterId,
          })
            .then(function () {
              return fetchPhotoLikeCount(photoKey);
            })
            .then(function (n) {
              countEl.textContent = String(n);
              likeBtn.setAttribute("aria-pressed", "true");
            })
            .catch(function () {});
        }
      });
    }

    function fetchComments(photoKey) {
      return restGet(
        remote,
        encodeURIComponent(remote.commentsTable) +
          "?select=id,author,body,parent_id,created_at&photo_key=eq." +
          encodeURIComponent(photoKey) +
          "&order=created_at.asc"
      );
    }

    function fetchCommentLikeCount(commentId) {
      return restGet(
        remote,
        encodeURIComponent(remote.commentLikesTable) +
          "?select=id&comment_id=eq." +
          encodeURIComponent(commentId)
      ).then(function (rows) {
        return Array.isArray(rows) ? rows.length : 0;
      });
    }

    function fetchUserCommentLike(commentId) {
      return restGet(
        remote,
        encodeURIComponent(remote.commentLikesTable) +
          "?select=id&comment_id=eq." +
          encodeURIComponent(commentId) +
          "&voter_id=eq." +
          encodeURIComponent(voterId)
      ).then(function (rows) {
        return Array.isArray(rows) && rows[0] ? rows[0].id : null;
      });
    }

    function renderCommentThread(container, photoKey, rows, reload) {
      container.innerHTML = "";
      var top = [];
      var byParent = {};
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r.parent_id) top.push(r);
        else {
          var k = r.parent_id;
          if (!byParent[k]) byParent[k] = [];
          byParent[k].push(r);
        }
      }

      function renderOne(c, depth) {
        var wrap = document.createElement("div");
        wrap.className = "comment-item";
        if (depth > 0) wrap.classList.add("comment-item--reply");
        var meta = document.createElement("div");
        meta.className = "comment-item__meta";
        var t = c.created_at ? formatTime(Date.parse(c.created_at)) : "";
        meta.textContent = (c.author || "?") + (t ? " · " + t : "");
        var body = document.createElement("div");
        body.className = "comment-item__body";
        body.textContent = c.body || "";
        var actions = document.createElement("div");
        actions.className = "comment-item__actions";
        var likeBtn = document.createElement("button");
        likeBtn.type = "button";
        likeBtn.className = "btn-like";
        var likeCount = document.createElement("span");
        likeCount.className = "btn-like__count";
        likeCount.textContent = "…";
        likeBtn.appendChild(document.createTextNode("♥ "));
        likeBtn.appendChild(likeCount);
        fetchCommentLikeCount(c.id).then(function (n) {
          likeCount.textContent = String(n);
        });
        fetchUserCommentLike(c.id).then(function (lid) {
          likeBtn.setAttribute("aria-pressed", lid ? "true" : "false");
        });
        likeBtn.addEventListener("click", function () {
          fetchUserCommentLike(c.id).then(function (likeId) {
            if (likeId) {
              restDelete(
                remote,
                remote.commentLikesTable,
                "id=eq." + encodeURIComponent(likeId)
              )
                .then(function () {
                  return fetchCommentLikeCount(c.id);
                })
                .then(function (n) {
                  likeCount.textContent = String(n);
                  likeBtn.setAttribute("aria-pressed", "false");
                })
                .catch(function () {});
            } else {
              restPost(remote, remote.commentLikesTable, {
                comment_id: c.id,
                voter_id: voterId,
              })
                .then(function () {
                  return fetchCommentLikeCount(c.id);
                })
                .then(function (n) {
                  likeCount.textContent = String(n);
                  likeBtn.setAttribute("aria-pressed", "true");
                })
                .catch(function () {});
            }
          });
        });
        var replyBtn = document.createElement("button");
        replyBtn.type = "button";
        replyBtn.className = "btn-text";
        replyBtn.textContent = "Reply";
        var replyWrap = document.createElement("div");
        replyWrap.className = "comment-reply-form";
        replyWrap.style.display = "none";
        var replyAuthor = document.createElement("input");
        replyAuthor.type = "text";
        replyAuthor.className = "field-input";
        replyAuthor.maxLength = 24;
        replyAuthor.placeholder = "Your name";
        var replyBody = document.createElement("textarea");
        replyBody.className = "field-input field-input--tall";
        replyBody.rows = 2;
        replyBody.maxLength = 500;
        replyBody.placeholder = "Reply…";
        var replySend = document.createElement("button");
        replySend.type = "button";
        replySend.className = "btn btn-secondary btn--small";
        replySend.textContent = "Post reply";
        replyBtn.addEventListener("click", function () {
          replyWrap.style.display =
            replyWrap.style.display === "none" ? "block" : "none";
        });
        replySend.addEventListener("click", function () {
          var au = sanitizeName(replyAuthor.value);
          var bd = sanitizeMessage(replyBody.value);
          if (!au || !bd) return;
          restPost(remote, remote.commentsTable, {
            photo_key: photoKey,
            author: au,
            body: bd,
            parent_id: c.id,
          })
            .then(function () {
              replyBody.value = "";
              replyWrap.style.display = "none";
              reload();
            })
            .catch(function () {});
        });
        replyWrap.appendChild(replyAuthor);
        replyWrap.appendChild(replyBody);
        replyWrap.appendChild(replySend);
        actions.appendChild(likeBtn);
        actions.appendChild(replyBtn);
        wrap.appendChild(meta);
        wrap.appendChild(body);
        wrap.appendChild(actions);
        wrap.appendChild(replyWrap);
        container.appendChild(wrap);
        var kids = byParent[c.id] || [];
        for (var j = 0; j < kids.length; j++) {
          renderOne(kids[j], depth + 1);
        }
      }

      for (var t = 0; t < top.length; t++) {
        renderOne(top[t], 0);
      }
    }

    function buildCard(name) {
      var card = document.createElement("div");
      card.className = "gallery-card";

      var media = document.createElement("div");
      media.className = "gallery-card__media";
      var img = document.createElement("img");
      img.src = storagePublicUrl(remote, name);
      img.alt = "Photo";
      img.loading = "lazy";
      media.appendChild(img);

      if (isOwnerLoggedIn()) {
        var del = document.createElement("button");
        del.type = "button";
        del.className = "gallery-remove";
        del.setAttribute("aria-label", "Remove this picture");
        del.textContent = "×";
        del.addEventListener("click", function () {
          ensureAccessToken(remote).then(function (token) {
            if (!token) {
              if (hint) hint.textContent = "Session expired — sign in again.";
              return;
            }
            deletePhotoRelatedData(remote, name)
              .then(function () {
                return storageDelete(remote, name, token);
              })
              .then(function () {
                return storageList(remote);
              })
              .then(function (rows) {
                render(fileNamesFromList(rows));
                updateHint(fileNamesFromList(rows).length);
              })
              .catch(function () {
                if (hint) hint.textContent = "Could not delete photo.";
              });
          });
        });
        media.appendChild(del);
      }

      var bar = document.createElement("div");
      bar.className = "gallery-card__bar";
      var likeBtn = document.createElement("button");
      likeBtn.type = "button";
      likeBtn.className = "btn-like";
      likeBtn.setAttribute("aria-label", "Like photo");
      var likeCount = document.createElement("span");
      likeCount.className = "btn-like__count";
      likeCount.textContent = "0";
      likeBtn.appendChild(document.createTextNode("♥ "));
      likeBtn.appendChild(likeCount);
      fetchPhotoLikeCount(name).then(function (n) {
        likeCount.textContent = String(n);
      });
      fetchUserPhotoLike(name).then(function (lid) {
        likeBtn.setAttribute("aria-pressed", lid ? "true" : "false");
      });
      likeBtn.addEventListener("click", function () {
        togglePhotoLike(name, likeBtn, likeCount);
      });

      var toggleComments = document.createElement("button");
      toggleComments.type = "button";
      toggleComments.className = "btn-text";
      toggleComments.textContent = "Comments";

      var panel = document.createElement("div");
      panel.className = "gallery-card__panel";
      panel.hidden = true;
      var thread = document.createElement("div");
      thread.className = "comment-thread";
      var compose = document.createElement("div");
      compose.className = "comment-compose";
      var ca = document.createElement("input");
      ca.type = "text";
      ca.className = "field-input";
      ca.maxLength = 24;
      ca.placeholder = "Your name";
      var cb = document.createElement("textarea");
      cb.className = "field-input field-input--tall";
      cb.rows = 2;
      cb.maxLength = 500;
      cb.placeholder = "Write a comment…";
      var cs = document.createElement("button");
      cs.type = "button";
      cs.className = "btn btn-secondary btn--small";
      cs.textContent = "Post";

      function reloadThread() {
        fetchComments(name).then(function (rows) {
          renderCommentThread(thread, name, Array.isArray(rows) ? rows : [], reloadThread);
        });
      }

      cs.addEventListener("click", function () {
        var au = sanitizeName(ca.value);
        var bd = sanitizeMessage(cb.value);
        if (!au || !bd) return;
        restPost(remote, remote.commentsTable, {
          photo_key: name,
          author: au,
          body: bd,
          parent_id: null,
        })
          .then(function () {
            cb.value = "";
            reloadThread();
          })
          .catch(function () {});
      });

      compose.appendChild(ca);
      compose.appendChild(cb);
      compose.appendChild(cs);
      panel.appendChild(thread);
      panel.appendChild(compose);

      toggleComments.addEventListener("click", function () {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) reloadThread();
      });

      bar.appendChild(likeBtn);
      bar.appendChild(toggleComments);
      card.appendChild(media);
      card.appendChild(bar);
      card.appendChild(panel);
      return card;
    }

    function render(names) {
      grid.innerHTML = "";
      if (!remote) return;
      for (var i = 0; i < names.length; i++) {
        grid.appendChild(buildCard(names[i]));
      }
    }

    function updateHint(count) {
      if (!hint) return;
      if (!remote) {
        hint.textContent =
          "Configure js/community-config.js with your Supabase URL and key.";
        return;
      }
      var o = isOwnerLoggedIn();
      hint.textContent =
        count === 0
          ? (o
              ? "No pictures yet — add one."
              : "No pictures yet. Owner can sign in above to upload.") +
            " Everyone can view; visitors can comment and like."
          : count +
            " photo(s). " +
            (o
              ? "You can manage uploads."
              : "Sign in as owner to add or remove photos.") +
            " Others can only view, comment, like, and reply.";
    }

    function refresh() {
      if (!remote) {
        updateHint(0);
        setToolbarDisabled(true);
        return;
      }
      updateToolbar();
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
              "Could not load pictures. Check Storage policies (see README).";
          }
          render([]);
        });
    }

    input.addEventListener("change", function () {
      if (!remote || !isOwnerLoggedIn()) return;
      var file = input.files && input.files[0];
      input.value = "";
      if (!file || !file.type || file.type.indexOf("image/") !== 0) return;

      ensureAccessToken(remote)
        .then(function (token) {
          if (!token) {
            if (hint) hint.textContent = "Sign in as owner to upload.";
            return Promise.reject(new Error("no token"));
          }
          return storageList(remote).then(function (rows) {
            var names = fileNamesFromList(rows);
            if (names.length >= MAX_PHOTOS) {
              if (hint)
                hint.textContent =
                  "Gallery is full (" + MAX_PHOTOS + " max). Remove one first.";
              return Promise.reject(new Error("full"));
            }
            return new Promise(function (resolve) {
              stripMetadataAndEncodeJpeg(file, resolve);
            }).then(function (blob) {
              if (!blob) {
                if (hint) hint.textContent = "Could not read that image.";
                return Promise.reject(new Error("bad"));
              }
              var objectName =
                (typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : "p-" + Date.now()) + ".jpg";
              return storageUpload(remote, objectName, blob, token);
            });
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
          if (err && err.message === "no token") return;
          if (hint)
            hint.textContent =
              "Upload failed. Sign in as owner and check Storage insert policy (your user id).";
        });
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!remote || !isOwnerLoggedIn()) return;
        if (!window.confirm("Remove every picture and its comments/likes?")) return;
        ensureAccessToken(remote).then(function (token) {
          if (!token) return;
          storageList(remote)
            .then(function (rows) {
              var names = fileNamesFromList(rows);
              var chain = Promise.resolve();
              for (var i = 0; i < names.length; i++) {
                (function (n) {
                  chain = chain.then(function () {
                    return deletePhotoRelatedData(remote, n).then(function () {
                      return storageDelete(remote, n, token);
                    });
                  });
                })(names[i]);
              }
              return chain;
            })
            .then(function () {
              return refresh();
            })
            .catch(function () {
              if (hint) hint.textContent = "Could not remove all.";
            });
        });
      });
    }

    window.addEventListener("fun-corner-auth", refresh);

    refresh();
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
      renderChatLog(logEl, cache, nameEl.value);
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
          setStatus("Messages load from Supabase.");
        })
        .catch(function () {
          setStatus("Could not load messages.");
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
        setStatus("Configure community-config.js first.");
        return;
      }
      var author = sanitizeName(nameEl.value);
      var text = sanitizeMessage(msgEl.value);
      if (!author) {
        setStatus("Pick a name.");
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
          setStatus("Send failed.");
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
      fetchRemote();
      pollTimer = window.setInterval(fetchRemote, POLL_MS);
    } else {
      cache = [];
      refreshView();
      nameEl.disabled = true;
      msgEl.disabled = true;
      sendBtn.disabled = true;
      setStatus("Configure community-config.js.");
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
    var remote = getRemote();
    var ownerCard = document.getElementById("owner-auth-card");
    if (ownerCard) ownerCard.hidden = !remote;

    function fireAuth() {
      window.dispatchEvent(new CustomEvent("fun-corner-auth"));
    }

    initOwnerAuth(remote, fireAuth);
    initGallery(remote);
    initWall();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayground);
  } else {
    initPlayground();
  }
})();
