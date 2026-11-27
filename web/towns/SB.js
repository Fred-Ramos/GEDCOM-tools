// Towns of SB (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Honiara",-943,15995,2],["Tulagi",-910,16015,5],["Gizo",-810,15684,5],["Buala",-814,15959,5],["Auki",-877,16070,5],["Lata",-1072,16580,5],["Kirakira",-1045,16192,5],["Taro",-671,15640,5],["Tandai",-945,15995,7],["Malango",-942,16005,7],["Malango",-970,15972,8],["Noro",-822,15720,8],["Munda",-833,15727,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["SB"] = T;
})(typeof window !== "undefined" ? window : globalThis);
