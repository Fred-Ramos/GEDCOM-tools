// Towns of FJ (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Suva",-1814,17843,2],["Levuka",-1807,17932,5],["Lautoka",-1762,17745,5],["Labasa",-1643,17936,5],["Ahau",-1250,17705,5],["Nasinu",-1807,17851,5],["Nadi",-1780,17742,6],["Lami",-1811,17841,7],["Sigatoka",-1814,17751,7],["Ba",-1753,17767,8],["Tubou",-1824,-17881,8],["Tavua",-1744,17786,8],["Savusavu",-1678,17934,8],["Vaileka",-1738,17815,9],["Navua",-1822,17817,9],["Vatukoula",-1750,17785,9]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["FJ"] = T;
})(typeof window !== "undefined" ? window : globalThis);
