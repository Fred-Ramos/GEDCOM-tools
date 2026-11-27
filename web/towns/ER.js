// Towns of ER (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Asmara",1534,3893,2],["Massawa",1561,3947,5],["Keren",1578,3845,5],["Barentu",1511,3759,5],["Assab",1301,4274,5],["Mendefera",1489,3882,5],["Himora",1430,3661,6],["Af’abet",1619,3869,6],["Adi Keyh",1484,3938,8],["Edd",1393,4169,8],["Dek’emhāre",1507,3905,8],["Mai-Mne",1455,3850,8],["Ak’ordat",1555,3788,8],["Dbarwa",1510,3883,9],["Āreza",1493,3857,9],["Dehalak’ Kebīr",1568,4002,10],["Badme",1473,3780,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["ER"] = T;
})(typeof window !== "undefined" ? window : globalThis);
