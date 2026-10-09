const map = L.map("map", { zoomControl: true }).setView([11.9237, 76.9398], 15);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 21,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const state = {
  selectedSurvey: "New official boundary",
  authMode: "register",
  user: loadSession(),
  watchId: null,
  currentPosition: null,
  marker: null,
  boundaryLayer: null,
  trackLayer: L.layerGroup().addTo(map),
  pointLayer: L.layerGroup().addTo(map),
  boundaries: loadBoundaries(),
  liveTrack: [],
};

const els = {
  gpsStatus: document.querySelector("#gpsStatus"),
  districtInput: document.querySelector("#districtInput"),
  talukInput: document.querySelector("#talukInput"),
  villageInput: document.querySelector("#villageInput"),
  surveyInput: document.querySelector("#surveyInput"),
  hissaInput: document.querySelector("#hissaInput"),
  surveyMeta: document.querySelector("#surveyMeta"),
  officialStatus: document.querySelector("#officialStatus"),
  startGpsBtn: document.querySelector("#startGpsBtn"),
  addPointBtn: document.querySelector("#addPointBtn"),
  finishBoundaryBtn: document.querySelector("#finishBoundaryBtn"),
  clearBoundaryBtn: document.querySelector("#clearBoundaryBtn"),
  pointCount: document.querySelector("#pointCount"),
  areaValue: document.querySelector("#areaValue"),
  accuracyValue: document.querySelector("#accuracyValue"),
  boundaryDistanceValue: document.querySelector("#boundaryDistanceValue"),
  geojsonInput: document.querySelector("#geojsonInput"),
  importGeojsonBtn: document.querySelector("#importGeojsonBtn"),
  recordsList: document.querySelector("#recordsList"),
  copyReportBtn: document.querySelector("#copyReportBtn"),
  reportOutput: document.querySelector("#reportOutput"),
  installBtn: document.querySelector("#installBtn"),
  authScreen: document.querySelector("#authScreen"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authSubmitBtn: document.querySelector("#authSubmitBtn"),
  authMessage: document.querySelector("#authMessage"),
  showRegisterBtn: document.querySelector("#showRegisterBtn"),
  showLoginBtn: document.querySelector("#showLoginBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  accountLabel: document.querySelector("#accountLabel"),
};

init();

function init() {
  [els.districtInput, els.talukInput, els.villageInput, els.surveyInput, els.hissaInput].forEach((input) => {
    input.addEventListener("input", () => {
      state.selectedSurvey = getSelectedSurveyId();
      renderBoundary();
    });
  });
  state.selectedSurvey = getSelectedSurveyId();
  els.surveyInput.addEventListener("change", () => {
    state.selectedSurvey = getSelectedSurveyId();
    renderBoundary();
  });
  els.startGpsBtn.addEventListener("click", startGps);
  els.addPointBtn.addEventListener("click", addCurrentPoint);
  els.finishBoundaryBtn.addEventListener("click", closeBoundary);
  els.clearBoundaryBtn.addEventListener("click", clearSelectedBoundary);
  els.importGeojsonBtn.addEventListener("click", importGeojson);
  els.copyReportBtn.addEventListener("click", copyReport);
  els.authForm.addEventListener("submit", handleAuthSubmit);
  els.showRegisterBtn.addEventListener("click", () => setAuthMode("register"));
  els.showLoginBtn.addEventListener("click", () => setAuthMode("login"));
  els.logoutBtn.addEventListener("click", logout);
  setupTabs();
  setupInstallPrompt();

  renderBoundary();
  renderAuthState();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = els.authEmail.value.trim().toLowerCase();
  const password = els.authPassword.value;

  if (!email || password.length < 6) {
    showAuthMessage("Enter a valid email and minimum 6-character password.", true);
    return;
  }

  const users = loadUsers();
  if (state.authMode === "register") {
    if (users[email]) {
      showAuthMessage("This email already exists. Use Login.", true);
      setAuthMode("login");
      return;
    }

    users[email] = {
      email,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    saveUsers(users);
    saveSession(email);
    state.user = { email };
    openDashboard("Account created. Opening your farm dashboard...");
    return;
  }

  if (!users[email]) {
    showAuthMessage("No account found. Register first.", true);
    setAuthMode("register");
    return;
  }

  const passwordHash = await hashPassword(password);
  if (users[email].passwordHash !== passwordHash) {
    showAuthMessage("Wrong password. Try again.", true);
    return;
  }

  saveSession(email);
  state.user = { email };
  openDashboard("Login successful. Opening your farm dashboard...");
}

function openDashboard(message) {
  showAuthMessage(message);
  renderAuthState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setAuthMode(mode) {
  state.authMode = mode;
  els.showRegisterBtn.classList.toggle("is-active", mode === "register");
  els.showLoginBtn.classList.toggle("is-active", mode === "login");
  els.authSubmitBtn.textContent = mode === "register" ? "Create Account" : "Login";
  els.authPassword.autocomplete = mode === "register" ? "new-password" : "current-password";
  showAuthMessage(mode === "register" ? "Create an account first, then login anytime." : "Login with an account created on this browser.");
}

function renderAuthState() {
  const isLoggedIn = Boolean(state.user);
  els.authScreen.hidden = isLoggedIn;
  document.querySelectorAll(".app-only").forEach((element) => {
    element.hidden = !isLoggedIn;
  });
  els.accountLabel.textContent = isLoggedIn ? state.user.email : "Live web app";
  if (isLoggedIn) {
    setTimeout(() => map.invalidateSize(), 50);
  }
}

function logout() {
  localStorage.removeItem("farm-boundary-session-v1");
  state.user = null;
  renderAuthState();
  setAuthMode("login");
}

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem("farm-boundary-users-v1")) || {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem("farm-boundary-users-v1", JSON.stringify(users));
}

function loadSession() {
  const email = localStorage.getItem("farm-boundary-session-v1");
  return email ? { email } : null;
}

function saveSession(email) {
  localStorage.setItem("farm-boundary-session-v1", email);
}

function showAuthMessage(message, isError = false) {
  els.authMessage.textContent = message;
  els.authMessage.classList.toggle("error", isError);
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function startGps() {
  if (!("geolocation" in navigator)) {
    setGpsStatus("GPS not supported");
    return;
  }

  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
  }

  setGpsStatus("Waiting for GPS...");
  state.watchId = navigator.geolocation.watchPosition(
    (position) => {
      state.currentPosition = position;
      const { latitude, longitude, accuracy } = position.coords;
      const latLng = [latitude, longitude];

      if (!state.marker) {
        state.marker = L.marker(latLng).addTo(map).bindPopup("Your live location");
        map.setView(latLng, 18);
      } else {
        state.marker.setLatLng(latLng);
      }

      els.addPointBtn.disabled = false;
      els.accuracyValue.textContent = `${Math.round(accuracy)} m`;
      updateLiveTrack(latLng);
      updateBoundaryPosition(latLng);
      setGpsStatus("GPS live");
    },
    (error) => {
      setGpsStatus(error.message || "GPS permission needed");
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
  );
}

function addCurrentPoint() {
  if (!state.currentPosition) return;
  const { latitude, longitude } = state.currentPosition.coords;
  const boundary = getSelectedBoundary();
  boundary.points.push([latitude, longitude]);
  boundary.closed = false;
  saveBoundaries();
  renderBoundary();
}

function closeBoundary() {
  const boundary = getSelectedBoundary();
  if (boundary.points.length < 3) return;
  boundary.closed = true;
  saveBoundaries();
  renderBoundary();
}

function clearSelectedBoundary() {
  state.boundaries[state.selectedSurvey] = { points: [], closed: false };
  saveBoundaries();
  renderBoundary();
}

function importGeojson() {
  try {
    const parsed = JSON.parse(els.geojsonInput.value);
    const points = polygonToLatLngs(parsed);
    if (points.length < 3) throw new Error("Polygon needs at least 3 points.");
    state.boundaries[state.selectedSurvey] = { points, closed: true, official: true, source: "Official/authorized GeoJSON import" };
    saveBoundaries();
    renderBoundary();
  } catch (error) {
    alert(`Could not import GeoJSON: ${error.message}`);
  }
}

function renderBoundary() {
  const survey = getSelectedSurvey();
  const boundary = getSelectedBoundary();

  els.surveyMeta.textContent = `Enter the exact village and survey number. Official boundary must come from Dishaank/Bhoomi/K-GIS or an authorized file; the app will not create fake government lines.`;
  els.officialStatus.textContent = boundary.official
    ? `${boundary.source}. Boundary loaded for ${survey.id}. Start live GPS to compare your location.`
    : "No official boundary loaded yet. Import official GeoJSON/KML or connect the authorized Karnataka API.";
  els.pointCount.textContent = String(boundary.points.length);
  els.finishBoundaryBtn.disabled = boundary.points.length < 3;

  state.pointLayer.clearLayers();
  if (state.boundaryLayer) {
    state.boundaryLayer.remove();
    state.boundaryLayer = null;
  }

  boundary.points.forEach((point, index) => {
    L.circleMarker(point, {
      radius: 6,
      color: "#145230",
      fillColor: "#1d6f42",
      fillOpacity: 0.9,
    })
      .bindTooltip(`${index + 1}`)
      .addTo(state.pointLayer);
  });

  if (boundary.points.length >= 2) {
    state.boundaryLayer = boundary.closed
      ? L.polygon(boundary.points, { color: "#1d6f42", weight: 3, fillOpacity: 0.18 }).addTo(map)
      : L.polyline(boundary.points, { color: "#1d6f42", weight: 3 }).addTo(map);
    map.fitBounds(state.boundaryLayer.getBounds(), { padding: [28, 28] });
  }

  els.areaValue.textContent = boundary.closed && boundary.points.length >= 3
    ? formatArea(calculateAreaSqMeters(boundary.points))
    : "Not closed";
  updateBoundaryPosition(getCurrentLatLng());
  renderRecords();
  renderReport();
}

function getSelectedBoundary() {
  if (!state.boundaries[state.selectedSurvey]) {
    state.boundaries[state.selectedSurvey] = { points: [], closed: false };
  }
  return state.boundaries[state.selectedSurvey];
}

function getSelectedSurveyId() {
  const parts = [
    els.districtInput.value.trim(),
    els.talukInput.value.trim(),
    els.villageInput.value.trim(),
    els.surveyInput.value.trim(),
    els.hissaInput.value.trim(),
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "New official boundary";
}

function getSelectedSurvey() {
  return {
    id: state.selectedSurvey,
    district: els.districtInput.value.trim() || "Karnataka",
    taluk: els.talukInput.value.trim() || "Taluk not entered",
    village: els.villageInput.value.trim() || "Village not entered",
    extent: "Official extent not loaded",
    owner: "Official RTC not loaded",
  };
}

function loadBoundaries() {
  try {
    return JSON.parse(localStorage.getItem("farm-boundaries-v1")) || {};
  } catch {
    return {};
  }
}

function saveBoundaries() {
  localStorage.setItem("farm-boundaries-v1", JSON.stringify(state.boundaries));
}

function setGpsStatus(text) {
  els.gpsStatus.textContent = text;
}

function getCurrentLatLng() {
  if (!state.currentPosition) return null;
  const { latitude, longitude } = state.currentPosition.coords;
  return [latitude, longitude];
}

function updateLiveTrack(latLng) {
  state.liveTrack.push(latLng);
  if (state.liveTrack.length > 500) state.liveTrack.shift();
  state.trackLayer.clearLayers();
  if (state.liveTrack.length >= 2) {
    L.polyline(state.liveTrack, { color: "#2563eb", weight: 3, opacity: 0.8 }).addTo(state.trackLayer);
  }
}

function updateBoundaryPosition(latLng) {
  const boundary = getSelectedBoundary();
  if (!latLng || !boundary.closed || boundary.points.length < 3) {
    els.boundaryDistanceValue.textContent = "No boundary";
    return;
  }

  const inside = isPointInsidePolygon(latLng, boundary.points);
  const distance = nearestBoundaryDistanceMeters(latLng, boundary.points);
  els.boundaryDistanceValue.textContent = inside
    ? `Inside · ${Math.round(distance)} m from line`
    : `Outside · ${Math.round(distance)} m from line`;
}

function isPointInsidePolygon(point, polygon) {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    const intersects = ((lngI > lng) !== (lngJ > lng)) &&
      (lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI);
    if (intersects) inside = !inside;
  }
  return inside;
}

function nearestBoundaryDistanceMeters(point, polygon) {
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polygon.length; i += 1) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    nearest = Math.min(nearest, distanceToSegmentMeters(point, start, end));
  }
  return nearest;
}

function distanceToSegmentMeters(point, start, end) {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos(toRadians(point[0]));
  const p = { x: point[1] * lngScale, y: point[0] * latScale };
  const a = { x: start[1] * lngScale, y: start[0] * latScale };
  const b = { x: end[1] * lngScale, y: end[0] * latScale };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  const projection = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(p.x - projection.x, p.y - projection.y);
}

function polygonToLatLngs(geojson) {
  const geometry = geojson.type === "Feature" ? geojson.geometry : geojson;
  if (!geometry) throw new Error("Missing geometry.");
  const coordinates = geometry.type === "Polygon"
    ? geometry.coordinates[0]
    : geometry.type === "MultiPolygon"
      ? geometry.coordinates[0][0]
      : null;
  if (!coordinates) throw new Error("Only Polygon or MultiPolygon is supported.");
  return coordinates.map(([lng, lat]) => [lat, lng]);
}

function calculateAreaSqMeters(points) {
  const earthRadius = 6378137;
  let area = 0;

  for (let i = 0; i < points.length; i += 1) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    area += toRadians(lng2 - lng1) * (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }

  return Math.abs((area * earthRadius * earthRadius) / 2);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function formatArea(squareMeters) {
  const acres = squareMeters / 4046.8564224;
  const guntas = acres * 40;
  return `${acres.toFixed(3)} acres / ${guntas.toFixed(1)} guntas`;
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
      tab.classList.add("is-active");

      const activeView = tab.dataset.view;
      document.querySelectorAll(".module-view").forEach((view) => {
        view.hidden = view.id !== `${activeView}View`;
      });
    });
  });
}

function renderRecords() {
  els.recordsList.innerHTML = "";
  const surveyIds = Object.keys(state.boundaries);
  if (!surveyIds.length) {
    els.recordsList.innerHTML = '<p class="muted">No official boundaries saved yet. Import an authorized boundary file first.</p>';
    return;
  }
  for (const surveyId of surveyIds) {
    const survey = {
      id: surveyId,
      village: "Official/imported boundary",
      extent: "Stored locally",
    };
    const boundary = state.boundaries[survey.id] || { points: [], closed: false };
    const row = document.createElement("article");
    row.className = "record-row";
    row.innerHTML = `
      <div>
        <strong>Survey ${survey.id}</strong>
        <span>${survey.village} · ${survey.extent}</span>
      </div>
      <div>
        <strong>${boundary.points.length} points</strong>
        <span>${boundary.official ? "Official/imported boundary" : "Walked GPS capture"}</span>
      </div>
    `;
    els.recordsList.append(row);
  }
}

function renderReport() {
  const survey = getSelectedSurvey();
  const boundary = getSelectedBoundary();
  const area = boundary.closed && boundary.points.length >= 3
    ? formatArea(calculateAreaSqMeters(boundary.points))
    : "Not closed";

  els.reportOutput.textContent = [
    "Farm Boundary Field Report",
    `Survey number: ${survey.id}`,
    `District: ${survey.district}`,
    `Taluk: ${survey.taluk}`,
    `Village: ${survey.village}`,
    `Recorded extent: ${survey.extent}`,
    `Official boundary points: ${boundary.points.length}`,
    `Official/imported area: ${area}`,
    `GPS accuracy: ${els.accuracyValue.textContent}`,
    `Position check: ${els.boundaryDistanceValue.textContent}`,
    "Note: This app does not fabricate government boundaries. Legal confirmation must come from official Karnataka land records or a licensed surveyor.",
  ].join("\n");
}

async function copyReport() {
  renderReport();
  try {
    await navigator.clipboard.writeText(els.reportOutput.textContent);
    els.copyReportBtn.textContent = "Report Copied";
    setTimeout(() => {
      els.copyReportBtn.textContent = "Copy Report Summary";
    }, 1600);
  } catch {
    alert("Copy failed. Select the report text manually.");
  }
}

function setupInstallPrompt() {
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.hidden = true;
  });
}
