/* 
Rede Geodésica Nacional

Aluno 1: Gonçalo Virgínia - 56773
Aluno 2: Antonio Duarte - 58278

Comentario:

HTML DOM documentation: https://www.w3schools.com/js/js_htmldom.asp
Leaflet documentation: https://leafletjs.com/reference-1.7.1.html
*/

/* Global Constants */

const MAP_CENTRE = [38.661, -9.2044]; // FCT coordinates

const MAP_ID = "mapid";

const MAP_ATTRIBUTION =
	'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
	'contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>';

const MAP_URL =
	"https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=" +
	"pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";
	"https://upload.wikimedia.org/wikipedia/commons/e/e0/SNice.svg";

const MAP_ERROR =
"https://upload.wikimedia.org/wikipedia/commons/e/e0/SNice.svg";

const MAP_LAYERS = [
	"navigation-night-v1",
	"streets-v11",
	"outdoors-v11",
	"light-v10",
	"dark-v10",
	"satellite-v9",
	"satellite-streets-v11",
	"navigation-day-v1",
];

const RESOURCES_DIR = "resources/";

const VG_ORDERS = ["order1", "order2", "order3", "order4"];

const RGN_FILE_NAME = "rgn.xml";

/* Global Variables */

let map;

/* Useful Functions */

// Capitalize the first letter of a string.
function capitalize(str) {
	return str.length > 0 ? str[0].toUpperCase() + str.slice(1) : str;
}

// Distance in km between to pairs of coordinates over the earth's surface.
// https://en.wikipedia.org/wiki/Haversine_formula
function haversine(lat1, lon1, lat2, lon2) {
	function toRad(deg) {
		return (deg * 3.1415926535898) / 180.0;
	}
	let dLat = toRad(lat2 - lat1),
		dLon = toRad(lon2 - lon1);
	let sa = Math.sin(dLat / 2.0),
		so = Math.sin(dLon / 2.0);
	let a = sa * sa + so * so * Math.cos(toRad(lat1)) * Math.cos(toRad(lat2));
	return 6372.8 * 2.0 * Math.asin(Math.sqrt(a));
}

function loadXMLDoc(filename) {
	let xhttp = new XMLHttpRequest();
	xhttp.open("GET", filename, false);
	try {
		xhttp.send();
	} catch (err) {
		alert(
			"Could not access the local geocaching database via AJAX.\n" +
			"Therefore, no POIs will be visible.\n"
		);
	}
	return xhttp.responseXML;
}

function getAllValuesByTagName(xml, name) {
	return xml.getElementsByTagName(name);
}

function getFirstValueByTagName(xml, name) {
	return getAllValuesByTagName(xml, name)[0].childNodes[0].nodeValue;
}

function between(x, y, z) {
	return x >= y && x <= z;
}

function defaultVGPopup(vg) {
	return "I'm the marker of VG <b>" +
			vg.name +
			"</b>.<br/>" +
			"<b>Order:</b> " +
			vg.order +
			"<br/><b>Type:</b> " +
			vg.type +
			"<br/><b>Altitude:</b> " +
			vg.altitude +
			"<br/><b>Latitude:</b> " +
			vg.latitude +
			"<br/><b>Longitude:</b> " +
			vg.longitude + 
			`<br/><input type="button" id="${vg.name}circle_same_type" value="Circle VGs Of Same Type" ` + 
			`onclick="toggleSameTypeCircles('${vg.type}');"/>` + 
			`<br/><input type="button" id="${vg.name}open_street_view" value="Open Street View" ` +
			`onclick="openStreetView('${vg.latitude}', '${vg.longitude}');"/>`;
}

/* 
	Function responsible for loading the VG information from the XML file,
	and creating VG's of the specified Order in the XML.
*/
function loadRGN(filename, map) {
	let xmlDoc = loadXMLDoc(filename);
	let xs = getAllValuesByTagName(xmlDoc, "vg");
	let vgOrders = [];

	for (let order in VG_ORDERS) {
		vgOrders.push(new VGOrderCollection());
	}

	if (xs.length == 0) {
		alert("Empty file");
	}

	else {
		for (let i = 0; i < xs.length; i++) {
			let name = getFirstValueByTagName(xs[i], "name"),
				order = getFirstValueByTagName(xs[i], "order"),
				type = getFirstValueByTagName(xs[i], "type"),
				altitude = getFirstValueByTagName(xs[i], "altitude"),
				latitude = getFirstValueByTagName(xs[i], "latitude"),
				longitude = getFirstValueByTagName(xs[i], "longitude"),
				marker = L.marker([latitude, longitude], {icon: map.icons["order" + order]}).bindTooltip(name);

			switch (order) {
				case '1':
					vgOrders[0].addVG(new VG1(name, type, parseFloat(altitude), parseFloat(latitude), parseFloat(longitude), marker));
					break;
				case '2':
					vgOrders[1].addVG(new VG2(name, type, parseFloat(altitude), parseFloat(latitude), parseFloat(longitude), marker));
					break;
				case '3':
					vgOrders[2].addVG(new VG3(name, type, parseFloat(altitude), parseFloat(latitude), parseFloat(longitude), marker));
					break;
				case '4':
					vgOrders[3].addVG(new VG4(name, type, parseFloat(altitude),parseFloat(latitude), parseFloat(longitude), marker));
					break;
			}
		}
	}

	return vgOrders;
}

/* Loads the icons */
function loadIcons(dir) {
	let icons = [];

	let iconOptions = {
		iconUrl: "??",
		shadowUrl: "??",
		iconSize: [16, 16],
		shadowSize: [16, 16],
		iconAnchor: [8, 8],
		shadowAnchor: [8, 8],
		popupAnchor: [0, -6], // offset the determines where the popup should open
	};

	for (let i = 0; i < VG_ORDERS.length; i++) {
		iconOptions.iconUrl = dir + VG_ORDERS[i] + ".png";
		icons[VG_ORDERS[i]] = L.icon(iconOptions);
	}

	return icons;
}

/* Collections */

/* Class that stores all the VG's from a specific order */
class VGOrderCollection {
	constructor() {
		this.vgs = [];
		this.validDistances = [];
		this.visible = true;
		this.lowestVG = null;
		this.highestVG = null;
		this.layerGroup = L.layerGroup();
		this.altitudeCirclesLayerGroup = L.layerGroup();
		this.sameTypeCirclesLayerGroup = L.layerGroup();
		this.sameOrderCirclesLayerGroup = L.layerGroup();
	}

	/* 
		Function that adds a VG and updates all the variables in the class
		to take the new VG in consideration.
	*/
	addVG(vg) {
		let circle;

		for (let i in this.vgs) {
			if (vg.validDistance(this.vgs[i])) {
				if (!this.validDistances.includes(vg)) {
					this.validDistances.push(vg);
				}

				if (!this.validDistances.includes(this.vgs[i])) {
					this.validDistances.push(this.vgs[i]);
				}
			}
		}

		if (isNaN(vg.altitude)) {
			circle = L.circle([vg.latitude, vg.longitude], 0, {
				color: "transparent",
				fillColor: "transparent",
			})
		}
		else {
			if ((this.highestVG === null) || (vg.altitude > this.highestVG.altitude)) {
				this.highestVG = vg;
			}
	
			if ((this.lowestVG === null) || (vg.altitude < this.lowestVG.altitude)) {
				this.lowestVG = vg;
			}

			circle = L.circle([vg.latitude, vg.longitude], vg.altitude * 3, {
				color: "#88c0d0",
				fillColor: "#8fbcbb",
				fillOpacity: 0.4,
			});
		}

		this.vgs.push(vg);
		this.altitudeCirclesLayerGroup.addLayer(circle);
	}

	/* That adds circles to the VGs of the same type. */
	addSameTypeCircles(type) {
		for (let i in this.vgs) {
			let vg = this.vgs[i];

			if (vg.type == type) {
				this.sameTypeCirclesLayerGroup.addLayer(
					L.circle([vg.latitude, vg.longitude], 500, {
					color: "#bf616a",
					fillColor: "#8fbcbb",
					fillOpacity: 0.4,	
				}));
			}
			else {
				this.sameTypeCirclesLayerGroup.addLayer(
					L.circle([vg.latitude, vg.longitude], 0));
			}
		}
	}

	addSameOrderCircles(name, order) {
		if (this.vgs.length > 0 && this.vgs[0].order == order) {
			for (let i in this.vgs) {
				let vg = this.vgs[i];

				if (vg.name != name) {
					this.sameOrderCirclesLayerGroup.addLayer(L.circle([vg.latitude, vg.longitude], 500, {
					color: "#a3be8c",
					fillColor: "#a3be8c",
					fillOpacity: 0.4,	
					}));
				}
			}
		}
		else {
			for (let i in this.vgs) {
				let vg = this.vgs[i];
				this.sameOrderCirclesLayerGroup.addLayer(
					L.circle([vg.latitude, vg.longitude], 0));	
			}
		}
	}
}

/* POI */

class POI {
	constructor(name, latitude, longitude, marker) {
		this.name = name;
		this.latitude = latitude;
		this.longitude = longitude;
		this.marker = marker;
	}
}

class VG extends POI {
	constructor(name, order, type, altitude, latitude, longitude, marker) {
		super(name, latitude, longitude, marker);
		this.order = order;
		this.type = type;
		this.altitude = altitude;
		this.marker.bindPopup(defaultVGPopup(this));
	}

	distanceTo(other) {
		return haversine(this.latitude, this.longitude, other.latitude, other.longitude);
	}
}

class VG1 extends VG {
	constructor(name, type, altitude, latitude, longitude, marker) {
		super(name, 1, type, altitude, latitude, longitude, marker);
		marker.on('click', () => this.updateVG1Popup(map));
	}

	validDistance(other) {
		return between(super.distanceTo(other), 30, 60);
	}

	updateVG1Popup(currentMap) {
		let total = 0;

		for (let i in currentMap.vgOrders) {
			let order = currentMap.vgOrders[i];

			if (order.visible) {
				for (let j in order.vgs) {
					let currentVG = order.vgs[j];
					
					if (this.name != currentVG.name && this.distanceTo(currentVG) <= 60) {
						total++;
					}
				}
			}
		}

		this.marker.setPopupContent(defaultVGPopup(this) + `<br/><b>Total VGs within 60km:</b> ${total}`);
	}
}

class VG2 extends VG {
	constructor(name, type, altitude, latitude, longitude, marker) {
		super(name, 2, type, altitude, latitude, longitude, marker);
		marker.setPopupContent(defaultVGPopup(this) + `<br/><input type="button" id="${this.name}vg2_same_order" value="Circle VGs Of Same Order Within 30km" ` + 
		`onclick="toggleSameOrderCircles('${this.name}', '${this.order}');"/>`);	
	}

	validDistance(other) {
		return between(super.distanceTo(other), 20, 30);
	}
}

class VG3 extends VG {
	constructor(name, type, altitude, latitude, longitude, marker) {
		super(name, 3, type, altitude, latitude, longitude, marker);
	}

	validDistance(other) {
		return between(super.distanceTo(other), 5, 10);
	}
}

class VG4 extends VG {
	constructor(name, type, altitude, latitude, longitude, marker) {
		super(name, 4, type, altitude, latitude, longitude, marker);
	}

	validDistance(other) {
		return true;
	}
}

/* Map */

class Map {
	constructor(center, zoom) {
		// load resources
		this.lmap = L.map(MAP_ID).setView(center, zoom); // creates the map with the specific view
		this.addBaseLayers(MAP_LAYERS); // the several different "map styles", such as satellite, streets etc ...
		this.icons = loadIcons(RESOURCES_DIR); // loads the icons
		this.vgOrders = loadRGN(RESOURCES_DIR + RGN_FILE_NAME, this);

		// cluster groups
		this.vgClusterGroup = L.markerClusterGroup();
		this.altitudeCirclesClusterGroup = L.markerClusterGroup({
			iconCreateFunction: function() {
				return L.divIcon({
					html:"",
					className: "" 
				});
			}
		});
		this.sameTypeCirclesClusterGroup = L.markerClusterGroup({
			iconCreateFunction: function() {
				return L.divIcon({
					html:"",
					className: ""
				});
			}
		});
		this.sameOrderCirclesClusterGroup = L.markerClusterGroup({
			iconCreateFunction: function() {
				return L.divIcon({
					html:"",
					className: ""
				});
			}
		});

		// layers
		this.lmap.addLayer(this.vgClusterGroup);
		this.lmap.addLayer(this.altitudeCirclesClusterGroup);
		this.lmap.addLayer(this.sameTypeCirclesClusterGroup);
		this.lmap.addLayer(this.sameOrderCirclesClusterGroup)

		// function calls and click handlers
		this.populate(); // populates everything with VGs and their respective markers
		this.addClickHandler((e) => L.popup().setLatLng(e.latlng).setContent("You clicked the map at " + e.latlng.toString()));
		this.lmap.on('click', () => {this.toggleOffAltitudeCircles(); this.toggleSameTypeCircles(""); this.toggleSameOrderCircles("", "");});
		this.altitudeCirclesActive = false;
		this.sameTypeCirclesActive = false;
		this.sameOrderCirclesActive = false;
	}

	/* Configures a specific map layer */
	makeMapLayer(name, spec) {
		let urlTemplate = MAP_URL;
		let attr = MAP_ATTRIBUTION;
		let errorTileUrl = MAP_ERROR;
		let layer = L.tileLayer(urlTemplate, {
			minZoom: 6,
			maxZoom: 19,
			errorTileUrl: errorTileUrl,
			id: spec,
			tileSize: 512,
			zoomOffset: -1,
			attribution: attr,
		});
		return layer;
	}

	/* Adds te base map/tile layers */
	addBaseLayers(specs) {
		let baseMaps = [];

		for (let i in specs) {
			baseMaps[capitalize(specs[i])] = this.makeMapLayer(
				specs[i],
				"mapbox/" + specs[i]
			);
		}

		baseMaps[capitalize(specs[0])].addTo(this.lmap);

		L.control
			.scale({ maxWidth: 150, metric: true, imperial: false })
			.setPosition("topleft")
			.addTo(this.lmap);

		L.control.layers(baseMaps, {}).setPosition("topleft").addTo(this.lmap);
		return baseMaps;
	}

	/* Populates the map with all icons and VGs */
	populate() {
		for (let i in this.vgOrders) {
			for (let j in this.vgOrders[i].vgs) {
				this.addMarker(this.vgOrders[i].vgs[j]);
			}
			
			this.vgClusterGroup.addLayer(this.vgOrders[i].layerGroup);
		}
	}

	addMarker(vg) {
		this.vgOrders[vg.order-1].layerGroup.addLayer(vg.marker);
	}

	addClickHandler(handler) {
		let m = this.lmap;

		function handler2(e) {
			return handler(e).openOn(m);
		}
		
		return this.lmap.on("click", handler2);
	}

	/* Adds a circle to the map */
	addCircle(pos, radius, popup) {
		let circle = L.circle(pos, radius, {
			color: "red",
			fillColor: "pink",
			fillOpacity: 0.4,
		});

		if (popup != "") {
			circle.bindPopup(popup);
		}

		return circle;
	}

	/* 
		Handles the removal and addition of LayerGroups to Clusters,
		associated with the toggling of VG orders.
	*/
	toggleLayerGroupVisibility(order) {
		let vgOrder = this.vgOrders[order];

		if (vgOrder.visible) {
			this.vgClusterGroup.removeLayer(vgOrder.layerGroup);
			
			if (this.altitudeCirclesActive) {
				this.altitudeCirclesClusterGroup.removeLayer(vgOrder.altitudeCirclesLayerGroup);
			}
			if (this.sameTypeCirclesActive) {
				this.sameTypeCirclesClusterGroup.removeLayer(vgOrder.sameTypeCirclesLayerGroup);
			}
			if (this.sameOrderCirclesActive) {
				this.sameOrderCirclesClusterGroup.removeLayer(vgOrder.sameOrderCirclesLayerGroup);
			}
		}
		else {
			this.vgClusterGroup.addLayer(vgOrder.layerGroup);
			
			if (this.altitudeCirclesActive) {
				this.altitudeCirclesClusterGroup.addLayer(vgOrder.altitudeCirclesLayerGroup)
			}
			if (this.sameTypeCirclesActive) {
				this.sameTypeCirclesClusterGroup.addLayer(vgOrder.sameTypeCirclesLayerGroup);
			}
			if (this.sameOrderCirclesActive) {
				this.sameOrderCirclesClusterGroup.addLayer(vgOrder.sameOrderCirclesLayerGroup);
			}
		}

		this.vgOrders[order].visible = !this.vgOrders[order].visible;
	}

	/* Returns the lowest VG amongst the currently visible VGs */
	getLowestVG() {
		let lowestVG = null;

		for (let order in VG_ORDERS) {
			if (this.vgOrders[order].visible && (lowestVG === null || 
				this.vgOrders[order].lowestVG.altitude < lowestVG.altitude)) {
				lowestVG = this.vgOrders[order].lowestVG;	
			}
		}

		return lowestVG;
	}

	/* Returns the highest VG amongst the currently visible VGs */
	getHighestVG() {
		let highestVG = null;

		for (let order in VG_ORDERS) {
			if (this.vgOrders[order].visible && (highestVG === null || 
				this.vgOrders[order].highestVG.altitude > highestVG.altitude)) {
				highestVG = this.vgOrders[order].highestVG;	
			}
		}

		return highestVG;
	}
	
	/* Toggles off the altitude circles */
	toggleOffAltitudeCircles() {
		if (this.altitudeCirclesActive) {
			this.toggleAltitudeCircles(this.vgOrders);
		}
	}

	/* Toggles altitude circles, and handles the layers and clusters associated with them */
	toggleAltitudeCircles() {
		for (let i in this.vgOrders) {
			let order = this.vgOrders[i];

			if (this.altitudeCirclesActive) {
				this.altitudeCirclesClusterGroup.removeLayer(order.altitudeCirclesLayerGroup);
			}
			else if (order.visible) {
				this.altitudeCirclesClusterGroup.addLayer(order.altitudeCirclesLayerGroup);
			}
		}

		this.altitudeCirclesActive = !this.altitudeCirclesActive;
	}

	/* Determines  which VGs are invalid and returns a list */
	validateDistances() {
		let invalidVGS = [];

		for (let i in this.vgOrders) {
			if (this.vgOrders[i].visible) {
				for (let j in this.vgOrders[i].vgs) {
					let vg = this.vgOrders[i].vgs[j];
					if (!this.vgOrders[i].validDistances.includes(vg)) {
						invalidVGS.push(vg);
					}
				}
			}
		}

		return invalidVGS;
	}

	/* Handles toggling clustering for the Circles of same type geodesic markers */
	toggleSameTypeCircles(type) {
		for (let i in this.vgOrders) {
			let order = this.vgOrders[i];

			if (this.sameTypeCirclesActive) {
				this.sameTypeCirclesClusterGroup.removeLayer(order.sameTypeCirclesLayerGroup);
				order.sameTypeCirclesLayerGroup.clearLayers();
			}
			else if (order.visible) {
				order.addSameTypeCircles(type);
				this.sameTypeCirclesClusterGroup.addLayer(order.sameTypeCirclesLayerGroup);
			}
		}

		this.sameTypeCirclesActive = !this.sameTypeCirclesActive;
	}

	/* Pans to the lowest VG in the map */
	panToLowest() {
		let lowest = this.getLowestVG(); 
		this.lmap.flyTo([lowest.latitude, lowest.longitude], 17);
	}

	/* Pans to the highest VG in the map */
	panToHighest() {
		let highest = this.getHighestVG(); 
		this.lmap.flyTo([highest.latitude, highest.longitude], 17);
	}

	toggleSameOrderCircles(name, order) {
		for (let i in this.vgOrders) {
			let currentOrder = this.vgOrders[i];

			if (this.sameOrderCirclesActive) {
				this.sameOrderCirclesClusterGroup.removeLayer(currentOrder.sameOrderCirclesLayerGroup);
				currentOrder.sameOrderCirclesLayerGroup.clearLayers();
			}
			else if (currentOrder.visible) {
				currentOrder.addSameOrderCircles(name, order);
				this.sameOrderCirclesClusterGroup.addLayer(currentOrder.sameOrderCirclesLayerGroup);
			}
		}

		this.sameOrderCirclesActive = !this.sameOrderCirclesActive;
	}
}

/* Functions for HTML */

/* Function called when the map loads */
function onLoad() {
	map = new Map(MAP_CENTRE, 12);
	map.addCircle(MAP_CENTRE, 100, "FCT/UNL");
	updateStatistics();
}

/* Function to toggle the visibility of a group layer */
function toggleLayerGroupVisibility(order) {
	map.toggleLayerGroupVisibility(order);
	updateStatistics();
}

/* Function that updates the statistics in the control panel HTML */
function updateStatistics() {
	// visible markers
	let totalVisibleMarkers = 0;
	
	for (let order in VG_ORDERS) {
		let orderVisibleMarkers = 0;

		if (map.vgOrders[order].visible) {
			orderVisibleMarkers = map.vgOrders[order].vgs.length;
		}

		document.getElementById(VG_ORDERS[order] + "_visible").innerHTML = orderVisibleMarkers;
		totalVisibleMarkers += orderVisibleMarkers;
	}

	document.getElementById("total_visible").innerHTML = totalVisibleMarkers;

	// lowest and highest marker
	let highestVGName = 'N/A', highestVG = map.getHighestVG();
	if (highestVG != null) {
		highestVGName = highestVG.name;
	}

	let lowestVGName = 'N/A', lowestVG = map.getLowestVG();
	if (map.getLowestVG() != null) {
		lowestVGName = lowestVG.name;
	}

	document.getElementById('highest_visible').innerHTML = highestVGName;
	document.getElementById('lowest_visible').innerHTML = lowestVGName;
}

/* Function that validates VGs and Displays an Alert */
function validateVGs() {
	let invalidVGS = map.validateDistances();
	let alertText = "VGs that do not respect order distances: \n\n";

	if (invalidVGS.length > 0) {
		for (let i in invalidVGS) {
			alertText += invalidVGS[i].name + '\n';
		}
	}
	else {
		alertText += 'There are no invalid VGs in the selected orders.'
	}

	alert(alertText);
}

/* Function called from HTML that toggles altitude circles */
function toggleAltitudeCircles() {
	map.toggleAltitudeCircles();
}

/* Function that toggles same type circles, called from HTML */
function toggleSameTypeCircles(type) {
	map.toggleSameTypeCircles(type);
}

/* Function that pans to the lowest VG called from HTML */
function panToLowestVG() {
	map.panToLowest();
}

/* Function that pans to the highest VG called from HTML */
function panToHighestVG() {
	map.panToHighest();
}

/* Function that opens google street view in a given latitude and longitude */
function openStreetView(latitude, longitude) {
	window.open(`http://maps.google.com/maps?q=&layer=c&cbll=${latitude},${longitude}`)
}

function toggleSameOrderCircles(name, order) {
	map.toggleSameOrderCircles(name, order);
}
