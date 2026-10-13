"use strict";

// The built-in deck is intentionally stored in source so the game needs no
// external prompt service, database, or internet connection.
const BUILT_IN_PROMPTS = [
  "The worst thing to hear from your pilot mid-flight is...",
  "A terrible name for a luxury hotel:",
  "What the sign at the world's least impressive museum says:",
  "The one thing you should never bring to a job interview:",
  "A suspicious item to find in the office break room:",
  "The real reason the town's mascot was fired:",
  "A phrase that makes any dinner party awkward:",
  "The world's least helpful superhero power:",
  "What your pet is secretly planning:",
  "A bad slogan for a dentist:",
  "The last thing you want your GPS to say:",
  "An unusual thing to put in a time capsule:",
  "The worst possible theme for a wedding:",
  "What not to write in a birthday card:",
  "A very questionable name for a new restaurant:",
  "The most disappointing prize to win:",
  "What the moon is made of, according to a very confident person:",
  "A terrible excuse for being late:",
  "The first rule of an extremely boring secret club:",
  "A sentence that would ruin a magician's big finale:"
];

module.exports = { BUILT_IN_PROMPTS };
