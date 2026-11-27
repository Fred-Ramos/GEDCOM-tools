// Towns of SR (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Paramaribo",587,-5517,2],["Totness",588,-5633,5],["Onverwacht",559,-5519,5],["Nieuw Nickerie",593,-5697,5],["Nieuw Amsterdam",589,-5509,5],["Lelydorp",570,-5523,5],["Groningen",580,-5547,5],["Brokopondo",506,-5498,5],["Albina",550,-5406,5],["Meerzorg",581,-5514,8],["Moengo",561,-5440,8],["Kampong Baroe",575,-5540,8],["Tamanredjo",579,-5502,9],["Jarikaba",581,-5533,9],["Alkmaar",585,-5502,9],["Brownsweg",500,-5515,9],["Mariënburg",588,-5504,9],["Wageningen",576,-5667,10],["Powakka",545,-5508,10],["Calcutta",584,-5567,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["SR"] = T;
})(typeof window !== "undefined" ? window : globalThis);
