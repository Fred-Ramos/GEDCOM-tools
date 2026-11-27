// Towns of IM (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Douglas",5415,-448,2],["Santon",5412,-458,5],["Ramsey",5432,-439,5],["Port Saint Mary",5407,-474,5],["Port Erin",5408,-475,5],["Peel",5422,-469,5],["Patrick",5420,-469,5],["Onchan",5417,-445,5],["Maughold",5430,-432,5],["Lezayre",5432,-442,5],["Laxey",5423,-440,5],["Kirkmichael",5429,-459,5],["Kirk Braddan",5417,-452,5],["Jurby",5436,-452,5],["Crosby",5418,-457,5],["Castletown",5407,-465,5],["Bride",5438,-439,5],["Ballasalla",5410,-463,5],["Ballabeg",5410,-468,5],["Andreas",5437,-443,5],["Ballaugh",5431,-454,5]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["IM"] = T;
})(typeof window !== "undefined" ? window : globalThis);
