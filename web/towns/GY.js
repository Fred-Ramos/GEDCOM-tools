// Towns of GY (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Georgetown",680,-5816,2],["Vreed-en-Hoop",681,-5819,5],["New Amsterdam",625,-5752,5],["Mahdia",528,-5915,5],["Mabaruma",820,-5978,5],["Linden",601,-5831,5],["Lethem",337,-5980,5],["Bartica",641,-5862,5],["Anna Regina",727,-5848,5],["Fort Wellington",639,-5760,5],["Corriverton",593,-5715,8],["Tuschen",688,-5834,8],["Rose Hall",626,-5736,8],["Skeldon",587,-5715,9],["Rosignol",627,-5754,9],["Mahaica Village",668,-5792,9],["Rose Hall",624,-5736,9],["Parika",684,-5843,9],["Mahaicony Village",657,-5781,10],["Windsor Forest",685,-5824,10],["Helena Number One",667,-5792,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["GY"] = T;
})(typeof window !== "undefined" ? window : globalThis);
