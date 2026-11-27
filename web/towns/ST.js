// Towns of ST (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["São Tomé",34,673,2],["Santo António",164,742,5],["Trindade",30,668,8],["São João dos Angolares",13,665,8],["Guadalupe",38,664,8],["Neves",36,655,8],["Água Izé",22,673,8],["Folha Fede",28,668,9],["Riboque",34,672,9],["Almas",30,674,9],["Pantufo",32,674,9],["Dona Eugénia",14,661,9],["Rosema",35,657,10],["Bombom",31,673,10],["Almeirim",32,672,10],["Piedade",30,666,11],["Micolo",40,669,11],["Ribeira Afonso",20,670,11],["Changra",35,669,11],["Lemos",30,670,11],["Santo Amaro",37,669,11],["Cova Barro",31,674,11],["Micondo",17,668,11],["Riboque Santana",25,674,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["ST"] = T;
})(typeof window !== "undefined" ? window : globalThis);
