(function () {
  "use strict";

  if (typeof THREE === "undefined") return;

  var WORLD = 12;
  var MAX_Y = 10;
  var SPEED = 6;
  var GRAVITY = 28;
  var JUMP = 10;

  function key(ix, iy, iz) {
    return ix + "," + iy + "," + iz;
  }

  function init() {
    var card = document.getElementById("blockworld-card");
    var root = document.getElementById("blockworld-root");
    if (!card || !root) return;

    var selectedType = 0;
    var blocks = new Map();
    var meshes = new Map();
    var blockGroup = new THREE.Group();

    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mats = [
      new THREE.MeshLambertMaterial({ color: 0x56b35a }),
      new THREE.MeshLambertMaterial({ color: 0x9a6b3c }),
      new THREE.MeshLambertMaterial({ color: 0x9e9e9e }),
      new THREE.MeshLambertMaterial({ color: 0xd66b5c }),
    ];

    var player = {
      x: WORLD / 2,
      y: 4,
      z: WORLD / 2,
      vy: 0,
      yaw: 0,
      pitch: 0,
    };

    var keys = {};
    var pointerLocked = false;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 14, 36);

    var camera = new THREE.PerspectiveCamera(
      70,
      root.clientWidth / Math.max(root.clientHeight, 1),
      0.1,
      80
    );

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(root.clientWidth, Math.max(root.clientHeight, 1));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    var canvas = renderer.domElement;
    canvas.className = "blockworld-canvas";
    canvas.setAttribute("tabindex", "0");
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", "3D block world");
    root.appendChild(canvas);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    var sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(8, 18, 10);
    scene.add(sun);
    scene.add(blockGroup);

    function solidAt(ix, iy, iz) {
      if (iy < 0 || iy > MAX_Y) return iy < 0;
      if (ix < 0 || ix >= WORLD || iz < 0 || iz >= WORLD) return false;
      return blocks.has(key(ix, iy, iz));
    }

    function playerCollides(px, py, pz) {
      var minX = Math.floor(px - 0.28);
      var maxX = Math.floor(px + 0.28);
      var minY = Math.floor(py);
      var maxY = Math.floor(py + 1.45);
      var minZ = Math.floor(pz - 0.28);
      var maxZ = Math.floor(pz + 0.28);
      for (var ix = minX; ix <= maxX; ix++) {
        for (var iy = minY; iy <= maxY; iy++) {
          for (var iz = minZ; iz <= maxZ; iz++) {
            if (solidAt(ix, iy, iz)) return true;
          }
        }
      }
      return false;
    }

    function setBlock(ix, iy, iz, type) {
      var k = key(ix, iy, iz);
      if (blocks.has(k)) return;
      if (iy < 0 || iy > MAX_Y) return;
      if (ix < 0 || ix >= WORLD || iz < 0 || iz >= WORLD) return;
      blocks.set(k, type);
      var mesh = new THREE.Mesh(geo, mats[type]);
      mesh.position.set(ix + 0.5, iy + 0.5, iz + 0.5);
      mesh.userData = { ix: ix, iy: iy, iz: iz };
      blockGroup.add(mesh);
      meshes.set(k, mesh);
    }

    function removeBlock(ix, iy, iz) {
      var k = key(ix, iy, iz);
      if (!blocks.has(k)) return;
      blocks.delete(k);
      var m = meshes.get(k);
      if (m) {
        blockGroup.remove(m);
        meshes.delete(k);
      }
    }

    function buildFloor() {
      for (var x = 0; x < WORLD; x++) {
        for (var z = 0; z < WORLD; z++) {
          setBlock(x, 0, z, 0);
        }
      }
    }

    buildFloor();

    var raycaster = new THREE.Raycaster();
    var centerNdc = new THREE.Vector2(0, 0);

    function raycastCenter() {
      raycaster.setFromCamera(centerNdc, camera);
      var hits = raycaster.intersectObjects(blockGroup.children, false);
      return hits.length ? hits[0] : null;
    }

    function onMouseDown(ev) {
      if (!pointerLocked) return;
      ev.preventDefault();
      var hit = raycastCenter();
      if (!hit) return;
      var u = hit.object.userData;
      if (ev.button === 0) {
        if (u.iy > 0) removeBlock(u.ix, u.iy, u.iz);
      } else if (ev.button === 2) {
        var n = hit.face.normal.clone();
        n.transformDirection(hit.object.matrixWorld);
        var nx = u.ix + Math.round(n.x);
        var ny = u.iy + Math.round(n.y);
        var nz = u.iz + Math.round(n.z);
        if (!playerCollides(nx + 0.5, ny, nz + 0.5) && !playerCollides(nx + 0.5, ny + 1, nz + 0.5)) {
          setBlock(nx, ny, nz, selectedType);
        }
      }
    }

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("contextmenu", function (e) {
      if (pointerLocked) e.preventDefault();
    });

    canvas.addEventListener("click", function () {
      if (!pointerLocked && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", function () {
      pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener("mousemove", function (e) {
      if (!pointerLocked) return;
      var sens = 0.0022;
      player.yaw -= e.movementX * sens;
      player.pitch -= e.movementY * sens;
      var lim = Math.PI / 2 - 0.08;
      if (player.pitch > lim) player.pitch = lim;
      if (player.pitch < -lim) player.pitch = -lim;
    });

    window.addEventListener("keydown", function (e) {
      keys[e.code] = true;
      if (e.code === "Digit1") selectType(0);
      if (e.code === "Digit2") selectType(1);
      if (e.code === "Digit3") selectType(2);
      if (e.code === "Digit4") selectType(3);
    });
    window.addEventListener("keyup", function (e) {
      keys[e.code] = false;
    });

    var typeButtons = card.querySelectorAll("[data-block-type]");
    function selectType(t) {
      selectedType = Math.max(0, Math.min(3, t));
      for (var i = 0; i < typeButtons.length; i++) {
        var b = typeButtons[i];
        var on = parseInt(b.getAttribute("data-block-type"), 10) === selectedType;
        b.classList.toggle("blockworld-type--active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      }
    }
    for (var j = 0; j < typeButtons.length; j++) {
      typeButtons[j].addEventListener("click", function () {
        selectType(parseInt(this.getAttribute("data-block-type"), 10));
      });
    }
    selectType(0);

    var resetBtn = card.querySelector("#blockworld-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        blocks.clear();
        while (blockGroup.children.length) blockGroup.remove(blockGroup.children[0]);
        meshes.clear();
        buildFloor();
        player.x = WORLD / 2;
        player.y = 4;
        player.z = WORLD / 2;
        player.vy = 0;
      });
    }

    function updateCamera() {
      camera.position.set(player.x, player.y + 1.45, player.z);
      camera.rotation.order = "YXZ";
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
      camera.rotation.z = 0;
    }

    var last = performance.now();
    function tick(now) {
      requestAnimationFrame(tick);
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (pointerLocked) {
        var fx = 0;
        var fz = 0;
        if (keys["KeyW"]) {
          fx -= Math.sin(player.yaw);
          fz -= Math.cos(player.yaw);
        }
        if (keys["KeyS"]) {
          fx += Math.sin(player.yaw);
          fz += Math.cos(player.yaw);
        }
        if (keys["KeyA"]) {
          fx -= Math.cos(player.yaw);
          fz += Math.sin(player.yaw);
        }
        if (keys["KeyD"]) {
          fx += Math.cos(player.yaw);
          fz -= Math.sin(player.yaw);
        }
        var len = Math.sqrt(fx * fx + fz * fz);
        if (len > 0.001) {
          fx = (fx / len) * SPEED * dt;
          fz = (fz / len) * SPEED * dt;
        }

        player.x += fx;
        if (playerCollides(player.x, player.y, player.z)) player.x -= fx;
        player.z += fz;
        if (playerCollides(player.x, player.y, player.z)) player.z -= fz;

        var grounded = playerCollides(player.x, player.y - 0.08, player.z);
        if (grounded && player.vy <= 0) {
          player.vy = 0;
          while (playerCollides(player.x, player.y - 0.02, player.z) && player.y < MAX_Y + 4) {
            player.y += 0.05;
          }
        } else {
          player.vy -= GRAVITY * dt;
        }
        if (keys["Space"] && grounded) {
          player.vy = JUMP;
        }
        player.y += player.vy * dt;
        if (player.y < -4) {
          player.y = 8;
          player.vy = 0;
          player.x = WORLD / 2;
          player.z = WORLD / 2;
        }
        while (playerCollides(player.x, player.y, player.z) && player.y < MAX_Y + 6) {
          player.y += 0.08;
        }
      }

      updateCamera();
      renderer.render(scene, camera);
    }

    function onResize() {
      var w = root.clientWidth;
      var h = Math.max(root.clientHeight, 240);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);
    onResize();

    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
