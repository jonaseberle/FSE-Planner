// import { getDistance, getRhumbLineBearing, convertDistance } from "geolib";
import L from "leaflet";

import Marker from "./Components/Marker.js";
import Job from "./Components/Job.js";
import { hideAirport, cleanLegsWithFlight } from "../util/utility.js";


function getMarkers(legs, opts) {
  let markers = new Set();
  // Add markers where a plane can be rented
  Object.keys(opts.planes).forEach(elm => {
    // Do not display airports that do not match the filtering criteria
    if (!hideAirport(elm, opts.settings.airport, opts.settings.display.sim)) {
      markers.add(elm)
    }
  });
  // Add markers in filtering options
  if (opts.fromIcao) { markers.add(opts.fromIcao); }
  if (opts.toIcao) { markers.add(opts.toIcao); }
  // Add markers in legs
  Object.keys(legs).forEach((key) => {
    let arr = key.split('-');
    markers.add(arr[0]);
    markers.add(arr[1]);
  });
  return [...markers];
}



function Jobs(props) {

  const s = props.options.settings;
  const group = L.layerGroup();

  let [legs, max] = cleanLegsWithFlight(props.options.jobs, props.options.flight, props.options);
  const markers = getMarkers(legs, props.options);
  const markerJobs = Object.fromEntries(markers.map(m => [m, []]));

  // Add Jobs
  const legsKeys = Object.keys(legs);
  for (var i = 0; i < legsKeys.length; i++) {
    const [fr, to] = legsKeys[i].split('-');
    const leg = legs[legsKeys[i]];
    const rleg = legs[to+'-'+fr]

    // Ensure only one line for both way legs
    if (rleg && fr > to) { continue; }

    // Compute line weight
    max = 100;
    const mw = parseFloat(s.display.legs.weights.passengers);
    const min = props.options.min || 1;
    const pay = (leg.flight?.pay ?? 0) + leg.pay + (rleg?.flight?.pay ?? 0) + (rleg?.pay ?? 0);
    const distanceWithShortRoutePenalty = leg.distance + 50;
    const payPerNm = pay / distanceWithShortRoutePenalty;
    let weight = parseFloat(s.display.legs.weights.base);
    if (mw && max !== min) {
      weight = Math.min(max, ((payPerNm-min) / (max-min)) * (mw - weight) + weight);
    }

    // Compute color
    let color = s.display.legs.colors.passengers;

    // Special color and weight if My assignments
    if (leg.flight || (rleg && rleg.flight)) {
      color = s.display.legs.colors.assignment;
      //weight = parseFloat(s.display.legs.weights.flight);
    }

    const job = Job({
      positions: [[props.options.icaodata[fr].lat, props.options.icaodata[fr].lon], [props.options.icaodata[to].lat, props.options.icaodata[to].lon]],
      color: color,
      highlight: s.display.legs.colors.highlight,
      weight: weight,
      leg: leg,
      rleg: rleg,
      options: props.options,
      actions: props.actions,
      fromIcao: fr,
      toIcao: to
    });
    job.addTo(group);

    markerJobs[fr].push(job);
    markerJobs[to].push(job);
  }

  // Add Markers
  for (i = 0; i < markers.length; i++) {
    const marker = markers[i];

    // Compute marker color
    let color = s.display.markers.colors.base;
    let size = s.display.markers.sizes.base;
    if (props.options.planes[marker]) {
      color = s.display.markers.colors.rentable;
      size = s.display.markers.sizes.rentable;
    }
    if (marker === props.options.fromIcao || marker === props.options.toIcao) {
      color = s.display.markers.colors.selected;
      size = s.display.markers.sizes.selected;
    }

    // Create marker
    Marker({
      position: [props.options.icaodata[marker].lat, props.options.icaodata[marker].lon],
      size: size,
      color: color,
      icao: marker,
      icaodata: props.options.icaodata,
      planes: props.options.planes[marker],
      siminfo: s.display.sim,
      actions: props.actions,
      allJobs: markerJobs[marker]
    })
      .on("mouseover", (e) => {
        const {allJobs} = e.target.options;

        allJobs.forEach(x => {
          x.options.prevColor = x.options.color;
          x.setStyle({color: s.display.legs.colors.highlight});
        });
      })
      .on("mouseout", (e) => {
        const {allJobs} = e.target.options;

        allJobs.forEach(x => x.setStyle({color: x.options.prevColor}));
      })
        .addTo(group)
  }

  return group;

};

export default Jobs;
