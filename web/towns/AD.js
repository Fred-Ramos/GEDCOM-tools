// Towns of AD (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Andorra la Vella",4251,152,2],["Sant Julià de Lòria",4246,149,5],["Ordino",4256,153,5],["les Escaldes",4251,153,5],["la Massana",4254,151,5],["Encamp",4253,158,5],["Canillo",4257,160,5],["Santa Coloma",4249,150,9],["Pas de la Casa",4254,173,10],["Arinsal",4257,148,11],["Vila",4253,157,11],["Les Bons",4254,159,11],["Aixirivall",4246,150,11],["Anyós",4253,153,11],["El Tarter",4258,165,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["AD"] = T;
})(typeof window !== "undefined" ? window : globalThis);
