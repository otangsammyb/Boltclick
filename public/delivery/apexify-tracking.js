/**
 * Apexify Advanced Tracking Engine
 * Mapbox GL JS Integration (3D & Voice Navigation)
 */

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; 
}

class ApexifyTracker {
    constructor(map, options = {}) {
        this.map = map;
        this.driverMarker = null;
        this.destMarker = null;
        this.lastUpdateTime = performance.now();
        this.bounded = false;
        
        this.config = {
            reRouteThreshold: 50,
            nearArrivalThreshold: 200,
            interpolationSpeed: 3,
            ...options
        };

        this.state = {
            currentLat: null,
            currentLng: null,
            targetLat: null,
            targetLng: null,
            destLat: null,
            destLng: null,
            heading: 0,
            isNearArrival: false,
            voiceAnnounced: new Set(),
            currentStepIndex: 0
        };

        this.speechSynth = window.speechSynthesis;
        this.initIcons();
        this.initPopups();
        
        // Disable follow camera if user drags or interacts with the map manually
        ['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach(evt => {
            this.map.on(evt, () => {
                this.config.followCamera = false;
                const b = document.getElementById('recenterBtn');
                if (b) {
                    b.style.transform = 'scale(1)';
                    b.style.display = 'flex';
                }
            });
        });
    }

    initIcons() {
        this.bikeEl = document.createElement('div');
        this.bikeEl.className = 'apex-bike-icon';
        this.bikeEl.innerHTML = `
            <div class="bike-marker" style="transition: transform 0.1s ease; width: 40px; height: 40px; cursor: pointer;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(0deg) drop-shadow(0 0 8px rgba(255,82,82,0.5));">
                    <circle cx="12" cy="12" r="10" fill="#ff5252" fill-opacity="0.2"/>
                    <circle cx="12" cy="12" r="6" fill="#ff5252"/>
                    <path d="M12 2L15 8H9L12 2Z" fill="white"/>
                </svg>
            </div>
        `;

        this.homeEl = document.createElement('div');
        this.homeEl.className = 'apex-home-icon';
        this.homeEl.innerHTML = `
            <div class="home-marker" style="width: 40px; height: 40px; cursor: pointer;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 8px rgba(255,82,82,0.5));">
                    <path d="M3 12L12 3L21 12V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V12Z" fill="#ff5252"/>
                    <path d="M9 21V12H15V21" stroke="white" stroke-width="2"/>
                </svg>
            </div>
        `;
    }

    initPopups() {
        this.driverPopup = new mapboxgl.Popup({ offset: 25, closeButton: false, closeOnClick: false })
            .setHTML(`
                <div style="color:var(--text);font-family:Inter,sans-serif;">
                    <div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;">Driver Status</div>
                    <div style="font-size:13px;font-weight:600;">In Transit <i class="hgi hgi-stroke hgi-car-02"></i></div>
                </div>
            `);

        this.destPopup = new mapboxgl.Popup({ offset: 25, closeButton: false, closeOnClick: false })
            .setHTML(`
                <div style="color:var(--text);font-family:Inter,sans-serif;">
                    <div style="font-size:11px;font-weight:700;color:#ff5252;text-transform:uppercase;">Dropoff Point</div>
                    <div style="font-size:13px;font-weight:600;" id="destPopupAddr">Awaiting...</div>
                </div>
            `);

        this.bikeEl.addEventListener('mouseenter', () => {
            if(this.state.currentLat) this.driverPopup.setLngLat([this.state.currentLng, this.state.currentLat]).addTo(this.map);
        });
        this.bikeEl.addEventListener('mouseleave', () => this.driverPopup.remove());

        this.homeEl.addEventListener('mouseenter', () => {
            if(this.state.destLat) this.destPopup.setLngLat([this.state.destLng, this.state.destLat]).addTo(this.map);
        });
        this.homeEl.addEventListener('mouseleave', () => this.destPopup.remove());
    }

    speak(text) {
        if (!this.speechSynth) return;
        this.speechSynth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        this.speechSynth.speak(utterance);
    }

    updatePosition(lat, lng, heading = null) {
        this.state.targetLat = lat;
        this.state.targetLng = lng;
        
        if (heading !== null && !isNaN(heading)) {
            this.state.heading = heading;
        } else {
            if (this.state.currentLat !== null && this.state.currentLng !== null) {
                const dy = lat - this.state.currentLat;
                const dx = lng - this.state.currentLng;
                if (dx !== 0 || dy !== 0) {
                    let calcHeading = Math.atan2(dx, dy) * 180 / Math.PI;
                    if (calcHeading < 0) calcHeading += 360;
                    this.state.heading = calcHeading;
                }
            }
        }

        if (this.state.currentLat === null) {
            this.state.currentLat = lat;
            this.state.currentLng = lng;
            this.createMarkers();
            
            // Eager bounds focus on user position
            this.map.flyTo({ center: [lng, lat], zoom: 16.5, speed: 0.8, pitch: 60 });
            
            if (this.state.destLat) {
                this.calculateRoute();
            }
        }

        if (this.config.followCamera) {
            this.map.easeTo({
                center: [lng, lat],
                bearing: this.state.heading,
                pitch: 70,
                zoom: 18,
                duration: 1500, // Mapbox native hardware smoothing synced to polling interval
                easing: x => x
            });
            const btn = document.getElementById('recenterBtn');
            if(btn && btn.style.display !== 'none') btn.style.display = 'none';
        }

        this.checkGeofencing();
    }

    createMarkers() {
        if (!this.driverMarker) {
            this.driverMarker = new mapboxgl.Marker({ element: this.bikeEl, pitchAlignment: 'map', rotationAlignment: 'map' })
                .setLngLat([this.state.currentLng, this.state.currentLat])
                .addTo(this.map);
        }
    }

    setDestination(lat, lng, addr) {
        this.state.destLat = lat;
        this.state.destLng = lng;
        
        // Update popup text
        const pt = document.getElementById('destPopupAddr');
        if (pt) pt.textContent = addr;

        // Force set popup HTML if element isn't in DOM yet
        this.destPopup.setHTML(`
            <div style="color:var(--text);font-family:Inter,sans-serif;">
                <div style="font-size:11px;font-weight:700;color:#ff5252;text-transform:uppercase;">Dropoff Point</div>
                <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;">${addr}</div>
            </div>
        `);
        
        if (this.destMarker) this.destMarker.remove();
        this.destMarker = new mapboxgl.Marker({ element: this.homeEl, anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(this.map);

        if (this.state.currentLat) {
            this.calculateRoute();
        }
    }

    async calculateRoute() {
        if (!this.state.currentLat || !this.state.destLat) return;

        const token = mapboxgl.accessToken;
        const start = `${this.state.currentLng},${this.state.currentLat}`;
        const end = `${this.state.destLng},${this.state.destLat}`;
        // Note: steps=true enables turn-by-turn instruction data
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start};${end}?steps=true&geometries=geojson&overview=full&radiuses=unlimited;unlimited&access_token=${token}`;
        
        try {
            const req = await fetch(url);
            const json = await req.json();
            if(!json.routes || json.routes.length === 0) return;
            const data = json.routes[0];
            const route = data.geometry.coordinates;
            
            // Snap the driver marker onto the exact start of the Mapbox route road
            if (json.waypoints && json.waypoints.length > 0) {
                this.state.targetLng = json.waypoints[0].location[0];
                this.state.targetLat = json.waypoints[0].location[1];
            }
            
            this.state.currentRoute = data;

            const geojson = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: route
                }
            };
            
            if (this.map.getSource('route')) {
                this.map.getSource('route').setData(geojson);
            } else {
                this.map.addSource('route', {
                    type: 'geojson',
                    data: geojson
                });
                
                // Find the first symbol layer in the style to insert beneath labels
                const styleLayer = this.map.getStyle().layers.find(l => l.type === 'symbol');
                const beforeId = styleLayer ? styleLayer.id : undefined;
                
                this.map.addLayer({
                    id: 'route-glow',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#00ed64', 'line-width': 22, 'line-opacity': 0.3, 'line-blur': 10 }
                }, beforeId);
                
                this.map.addLayer({
                    id: 'route',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#00ed64', 'line-width': 10, 'line-opacity': 1.0 }
                }, beforeId);
            }
            
            if(route.length > 0) {
               const bounds = route.reduce(function (b, coord) {
                   return b.extend(coord);
               }, new mapboxgl.LngLatBounds(route[0], route[0]));
               
               this.map.fitBounds(bounds, {
                   padding: { top: 60, bottom: 120, left: 60, right: 60 },
                   pitch: 60
               });
               this.bounded = true;
            }

            this.processInstructions(data.legs[0].steps);
            
            const dist = (data.distance / 1000).toFixed(1);
            document.getElementById('activeDestDist').textContent = `${dist} km away · Optimized Path`;
            
            this.speak("Delivery route calculated. Let's go.");
        } catch(e) {
            console.error("Apexify Routing error:", e);
        }
    }

    processInstructions(steps) {
        this.instructions = steps;
        this.state.currentStepIndex = 0;
        this.state.voiceAnnounced.clear();
        
        const nav = document.getElementById('navigationOverlay');
        if (nav) {
             nav.style.display = 'flex';
             setTimeout(() => { nav.style.opacity = '1'; nav.style.transform = 'translateY(0)'; }, 10);
        }
    }

    animate(time) {
        const dt = (time - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = time;

        if (this.state.currentLat !== null && this.driverMarker) {
            const lerp = Math.min(dt * this.config.interpolationSpeed, 1);
            this.state.currentLat += (this.state.targetLat - this.state.currentLat) * lerp;
            this.state.currentLng += (this.state.targetLng - this.state.currentLng) * lerp;

            this.driverMarker.setLngLat([this.state.currentLng, this.state.currentLat]);
            
            // update popup dynamically if it's open
            if(this.driverPopup.isOpen()) {
                this.driverPopup.setLngLat([this.state.currentLng, this.state.currentLat]);
            }

            const inner = this.bikeEl.querySelector('.bike-marker');
            if (inner) inner.style.transform = `rotate(${this.state.heading}deg)`;
            
            this.checkNavigation();
        }
        requestAnimationFrame(this.animate.bind(this));
    }

    checkNavigation() {
        if (!this.instructions || this.state.currentStepIndex >= this.instructions.length) {
            const nav = document.getElementById('navigationOverlay');
            if(nav) { nav.style.opacity = '0'; nav.style.transform = 'translateY(-20px)'; }
            return;
        }

        const nextStep = this.instructions[this.state.currentStepIndex];
        const stepCoords = nextStep.maneuver.location; // [lng, lat]
        const distToStep = getDistance(this.state.currentLat, this.state.currentLng, stepCoords[1], stepCoords[0]);

        const instructionText = nextStep.maneuver.instruction || "Proceed on route";
        
        // Update Google Maps Style UI overlay
        const distEl = document.getElementById('navDistance');
        const instEl = document.getElementById('navInstruction');
        if (distEl) distEl.textContent = distToStep < 1000 ? `${Math.round(distToStep)}m away` : `${(distToStep/1000).toFixed(1)}km away`;
        if (instEl) instEl.textContent = instructionText;

        if (distToStep < 200 && !this.state.voiceAnnounced.has(this.state.currentStepIndex + '_early')) {
            this.speak("In 200 meters, " + instructionText);
            this.state.voiceAnnounced.add(this.state.currentStepIndex + '_early');
            document.getElementById('activeDestDist').textContent = "Next: " + instructionText + ` (${Math.round(distToStep)}m)`;
        }

        if (distToStep < 25) {
            if (!this.state.voiceAnnounced.has(this.state.currentStepIndex + '_now')) {
                this.speak(instructionText);
                this.state.voiceAnnounced.add(this.state.currentStepIndex + '_now');
            }
            this.state.currentStepIndex++;
        }
    }

    checkGeofencing() {
        if (!this.state.destLat || !this.state.currentLat) return;
        const dist = getDistance(this.state.currentLat, this.state.currentLng, this.state.destLat, this.state.destLng);

        if (dist < this.config.nearArrivalThreshold && !this.state.isNearArrival) {
            this.state.isNearArrival = true;
            this.speak("You are arriving at the destination.");
            this.triggerArrivalUI();
        }
    }

    triggerArrivalUI() {
        const el = document.getElementById('activeDestAddr');
        if (el) {
            el.style.color = '#00ed64';
            el.innerHTML = '⚡ ARRIVING AT DESTINATION ⚡';
            el.style.animation = 'pulse 1s infinite';
        }
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
    }
    
    .mapboxgl-popup-content {
        background: rgba(11,17,20,0.85) !important;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px !important;
        padding: 12px 16px !important;
        box-shadow: 0 8px 16px rgba(0,0,0,0.4) !important;
    }
    
    .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
        border-top-color: rgba(11,17,20,0.85) !important;
    }
    .mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
        border-bottom-color: rgba(11,17,20,0.85) !important;
    }
`;
document.head.appendChild(style);
