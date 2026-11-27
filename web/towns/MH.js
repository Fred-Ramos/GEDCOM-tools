// Towns of MH (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Majuro",709,17138,2],["Likiep",983,16931,5],["Jabor",592,16964,5],["Ailuk",1022,16998,5],["Taroa",871,17123,5],["Ebaye",877,16774,5],["Enewetak",1135,16234,5],["Ebon",458,16870,5],["Aur",815,17117,5],["Arno",707,17155,5],["Airuk",728,16882,5],["Mili",608,17174,5],["Lae",892,16626,5],["Utrik",1123,16985,5],["Ujae",893,16576,5],["Rongelap",1116,16689,5],["Loen",776,16823,5],["Namdrik",560,16810,5],["Mejit",1028,17086,5],["Lib",831,16738,5],["Kili",564,16912,5],["Jabat",775,16898,5],["Wotje",945,17024,5],["Wotho",1017,16601,5],["Dalap-Uliga-Dorrit",709,17138,7],["Laura",715,17104,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["MH"] = T;
})(typeof window !== "undefined" ? window : globalThis);
