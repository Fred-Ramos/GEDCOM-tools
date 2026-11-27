// Towns of AW (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Oranjestad",1252,-7003,2],["Noord",1257,-7003,7],["Tanki Leendert",1254,-7002,7],["Santa Cruz",1251,-6998,7],["San Nicolas",1244,-6991,8],["Butucu",1247,-6991,8],["Paradera",1254,-7001,8],["Savaneta",1245,-6994,8],["Malmok",1260,-7005,9],["Pos Chiquito",1246,-6996,9]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["AW"] = T;
})(typeof window !== "undefined" ? window : globalThis);
