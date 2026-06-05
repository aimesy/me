(function () {
  const themeKey = "amyc-theme";
  const lightnessKey = "amyc-lightness";
  const customCssKey = "amyc-custom-css";
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const adjustableTokens = [
    "paper", "paper-2", "paper-3", "plain", "plain-soft", "page-paper", "page-line",
    "ink", "ink-2", "ink-3", "ink-4", "rule", "rule-2", "chrome", "chrome-ink",
    "chrome-rule", "chrome-accent", "accent", "accent-2", "link", "warn", "ok",
    "good-border", "good-bg", "warn-border", "warn-bg", "warn-ink", "bar-fill",
    "row-hover",
  ];
  let baseThemeTokens = {};
  let currentLightness = 0;
  const themes = [
    {
      id: "mist",
      name: "Mist",
      note: "Pastel blue",
      colors: ["#17323a", "#f5fbfd", "#8fd3c5", "#ffffff"],
      themeColor: "#17323a",
    },
    {
      id: "lilac",
      name: "Lilac",
      note: "Pastel purple",
      colors: ["#28243f", "#f2effa", "#a8d5b5", "#ffffff"],
      themeColor: "#28243f",
    },
    {
      id: "glacier",
      name: "Glacier",
      note: "Icy cobalt",
      colors: ["#16315e", "#f1f7ff", "#8ac7ff", "#ffffff"],
      themeColor: "#16315e",
    },
    {
      id: "rose",
      name: "Rose",
      note: "Soft rose",
      colors: ["#3a2831", "#f8eef2", "#e0b15f", "#ffffff"],
      themeColor: "#3a2831",
    },
    {
      id: "sand",
      name: "Sand",
      note: "Warm sand",
      colors: ["#24211d", "#f2efe7", "#caa85a", "#fbfaf6"],
      themeColor: "#24211d",
    },
    {
      id: "tidepool",
      name: "Tidepool",
      note: "Coastal green",
      colors: ["#15302d", "#edf4f2", "#8bc4b1", "#ffffff"],
      themeColor: "#15302d",
    },
    {
      id: "cypress",
      name: "Cypress",
      note: "Green black",
      colors: ["#070c09", "#111713", "#bfcf79", "#151c17"],
      themeColor: "#070c09",
    },
    {
      id: "starlight",
      name: "Starlight",
      note: "Black violet",
      colors: ["#0b0710", "#17131a", "#d0ad62", "#1c1720"],
      themeColor: "#0b0710",
    },
  ];
  const themeVariants = {
    mist: {
      light: {
        paper: "#fbfeff", "paper-2": "#f6fcfe", "paper-3": "#e9f7fb",
        plain: "#ffffff", "plain-soft": "#fcfeff", "page-paper": "#ffffff", "page-line": "#edf7fa",
        rule: "#d8e8ed", "rule-2": "#eef7fa", chrome: "#1c4650", "chrome-rule": "#12323a",
        "chrome-accent": "#84d7c7", accent: "#2a8191", "accent-2": "#52a8b1", link: "#1e6579",
        warn: "#a04a42", ok: "#27704f", "good-border": "#b1dec9", "good-bg": "#f0fbf5",
        "warn-border": "#efc7b9", "warn-bg": "#fff1ed", "warn-ink": "#7d4036",
        "bar-fill": "#55a9b4", "row-hover": "#eefafd",
      },
      dark: {
        paper: "#102127", "paper-2": "#09171c", "paper-3": "#183039",
        plain: "#132830", "plain-soft": "#0d1c22", "page-paper": "#172d35", "page-line": "#27444f",
        rule: "#2c4d58", "rule-2": "#1d3740", chrome: "#050c0f", "chrome-rule": "#020608",
        "chrome-accent": "#94ddd0", accent: "#81d2d7", "accent-2": "#74b9c8", link: "#9bdbe4",
        warn: "#f09b86", ok: "#8ed8ae", "good-border": "#46755e", "good-bg": "#13271c",
        "warn-border": "#805f51", "warn-bg": "#2a1d18", "warn-ink": "#f0b59d",
        "bar-fill": "#78c9d0", "row-hover": "#172c34",
      },
    },
    lilac: {
      light: {
        paper: "#fdfaff", "paper-2": "#f6f1fd", "paper-3": "#ebe2f6",
        plain: "#ffffff", "plain-soft": "#fdfbff", "page-paper": "#fffaff", "page-line": "#eee6f6",
        rule: "#d9cfe8", "rule-2": "#eee7f4", chrome: "#352b54", "chrome-rule": "#241b3d",
        "chrome-accent": "#a8d5b5", accent: "#6f62ad", "accent-2": "#8c80c9", link: "#5668a5",
        warn: "#a6415a", ok: "#34704e", "good-border": "#bbdcc5", "good-bg": "#f0faef",
        "warn-border": "#efbdcc", "warn-bg": "#fff0f4", "warn-ink": "#7c3548",
        "bar-fill": "#8987cc", "row-hover": "#f7f1fc",
      },
      dark: {
        paper: "#191323", "paper-2": "#100c17", "paper-3": "#261e31",
        plain: "#1e1728", "plain-soft": "#17111f", "page-paper": "#251d30", "page-line": "#372d44",
        rule: "#42364f", "rule-2": "#2d2538", chrome: "#09060f", "chrome-rule": "#050309",
        "chrome-accent": "#c4dca8", accent: "#bbb2ff", "accent-2": "#9f98e8", link: "#bac7ff",
        warn: "#f18aa4", ok: "#93d9ae", "good-border": "#55755f", "good-bg": "#18261b",
        "warn-border": "#765066", "warn-bg": "#2a1922", "warn-ink": "#f2a9bd",
        "bar-fill": "#b1a8ff", "row-hover": "#221a2d",
      },
    },
    glacier: {
      light: {
        paper: "#ffffff", "paper-2": "#f6fbff", "paper-3": "#e8f3ff",
        plain: "#ffffff", "plain-soft": "#fbfdff", "page-paper": "#ffffff", "page-line": "#dcecff",
        rule: "#c5d9f2", "rule-2": "#e4f0fb", chrome: "#173a70", "chrome-rule": "#0b2349",
        "chrome-accent": "#9bd2ff", accent: "#1e65bd", "accent-2": "#3f8bea", link: "#245fa8",
        warn: "#9d4050", ok: "#2f7065", "good-border": "#9fd1ca", "good-bg": "#eef9f7",
        "warn-border": "#d9a6b1", "warn-bg": "#fff1f4", "warn-ink": "#793240",
        "bar-fill": "#4f96ef", "row-hover": "#f0f7ff",
      },
      dark: {
        paper: "#081326", "paper-2": "#040b18", "paper-3": "#102248",
        plain: "#0b1730", "plain-soft": "#071021", "page-paper": "#0f1f3d", "page-line": "#223a62",
        rule: "#294876", "rule-2": "#182f55", chrome: "#02060d", "chrome-rule": "#010305",
        "chrome-accent": "#9ed1ff", accent: "#92c8ff", "accent-2": "#70adf0", link: "#addcff",
        warn: "#ef91a4", ok: "#8ed8c8", "good-border": "#4e786f", "good-bg": "#122720",
        "warn-border": "#7a5360", "warn-bg": "#281923", "warn-ink": "#f0a8b7",
        "bar-fill": "#7ab8ff", "row-hover": "#102345",
      },
    },
    rose: {
      light: {
        paper: "#fffbfd", "paper-2": "#faf1f5", "paper-3": "#eee2e8",
        plain: "#ffffff", "plain-soft": "#fffafd", "page-paper": "#fffef9", "page-line": "#f0e4da",
        rule: "#dfd0d8", "rule-2": "#f0e6eb", chrome: "#432e38", "chrome-rule": "#2d1e25",
        "chrome-accent": "#e0b15f", accent: "#8e5269", "accent-2": "#ba738b", link: "#516a82",
        warn: "#9a4248", ok: "#3e7353", "good-border": "#bbd5bd", "good-bg": "#f1f9ef",
        "warn-border": "#e4b8bc", "warn-bg": "#fff0f2", "warn-ink": "#7b3840",
        "bar-fill": "#c17c94", "row-hover": "#fbf2f6",
      },
      dark: {
        paper: "#191017", "paper-2": "#100a0e", "paper-3": "#271a23",
        plain: "#1e141b", "plain-soft": "#160e13", "page-paper": "#241820", "page-line": "#382833",
        rule: "#463440", "rule-2": "#30232c", chrome: "#080405", "chrome-rule": "#030102",
        "chrome-accent": "#e2bb71", accent: "#e0a4ba", "accent-2": "#c1849f", link: "#aec9ec",
        warn: "#ef9098", ok: "#90d5a7", "good-border": "#587a5c", "good-bg": "#19251a",
        "warn-border": "#795059", "warn-bg": "#2a1920", "warn-ink": "#f0a8b0",
        "bar-fill": "#d491aa", "row-hover": "#241821",
      },
    },
    sand: {
      light: {
        paper: "#fffdf8", "paper-2": "#f8f3ea", "paper-3": "#eadfce",
        plain: "#ffffff", "plain-soft": "#fffdf9", "page-paper": "#fffef9", "page-line": "#f0e4d2",
        rule: "#dccdbb", "rule-2": "#eee5dc", chrome: "#342c22", "chrome-rule": "#211b14",
        "chrome-accent": "#caa85a", accent: "#70501a", "accent-2": "#9a7024", link: "#365f6b",
        warn: "#8f3d30", ok: "#28643e", "good-border": "#b5ccb0", "good-bg": "#f4f8ed",
        "warn-border": "#d8b88a", "warn-bg": "#fbf3df", "warn-ink": "#725414",
        "bar-fill": "#a9843b", "row-hover": "#f8f3ea",
      },
      dark: {
        paper: "#181511", "paper-2": "#100e0c", "paper-3": "#272018",
        plain: "#1d1914", "plain-soft": "#15120f", "page-paper": "#221c16", "page-line": "#332a20",
        rule: "#44382b", "rule-2": "#2d251c", chrome: "#080604", "chrome-rule": "#030201",
        "chrome-accent": "#d9b86a", accent: "#d6b061", "accent-2": "#bb8d3f", link: "#9ccdd7",
        warn: "#e48a78", ok: "#8acc91", "good-border": "#4d6d51", "good-bg": "#182218",
        "warn-border": "#795c3a", "warn-bg": "#2b2116", "warn-ink": "#e5bd7d",
        "bar-fill": "#c99a4a", "row-hover": "#211b15",
      },
    },
    tidepool: {
      light: {
        paper: "#f9fdfb", "paper-2": "#f1f8f6", "paper-3": "#e0eee9",
        plain: "#ffffff", "plain-soft": "#f8fcfa", "page-paper": "#fbfffc", "page-line": "#e1eee8",
        rule: "#c9ddd8", "rule-2": "#e4efec", chrome: "#193a36", "chrome-rule": "#0f2926",
        "chrome-accent": "#91ceb7", accent: "#23716f", "accent-2": "#4c9490", link: "#1d6377",
        warn: "#99483b", ok: "#2d7357", "good-border": "#a5d2c1", "good-bg": "#eaf8f2",
        "warn-border": "#dcb8aa", "warn-bg": "#fbf0eb", "warn-ink": "#814a3c",
        "bar-fill": "#519c98", "row-hover": "#ebf7f4",
      },
      dark: {
        paper: "#0e1918", "paper-2": "#08100f", "paper-3": "#182826",
        plain: "#12211f", "plain-soft": "#0c1715", "page-paper": "#162623", "page-line": "#283c38",
        rule: "#31504b", "rule-2": "#203632", chrome: "#030a09", "chrome-rule": "#010403",
        "chrome-accent": "#8edbc3", accent: "#83d2c8", "accent-2": "#62bab0", link: "#a0e1dc",
        warn: "#ef9380", ok: "#92d7ae", "good-border": "#4e7867", "good-bg": "#14261f",
        "warn-border": "#7c5b51", "warn-bg": "#2a1d18", "warn-ink": "#f0af9d",
        "bar-fill": "#74cbc3", "row-hover": "#172724",
      },
    },
    cypress: {
      light: {
        paper: "#f6fbf3", "paper-2": "#ecf5e8", "paper-3": "#dcebd5",
        plain: "#ffffff", "plain-soft": "#f8fcf6", "page-paper": "#fffef4", "page-line": "#e4e8d2",
        rule: "#cdddc3", "rule-2": "#e4eddf", chrome: "#25391d", "chrome-rule": "#172711",
        "chrome-accent": "#aabf50", accent: "#5c7429", "accent-2": "#7f953a", link: "#39736b",
        warn: "#9a5a38", ok: "#3d7446", "good-border": "#adcaa0", "good-bg": "#eef8eb",
        "warn-border": "#d8b88e", "warn-bg": "#fbf0df", "warn-ink": "#78512e",
        "bar-fill": "#8fa34a", "row-hover": "#eef7ea",
      },
      dark: {
        paper: "#080d0a", "paper-2": "#050806", "paper-3": "#131b14",
        plain: "#0d140f", "plain-soft": "#09100b", "page-paper": "#172015", "page-line": "#2a3524",
        rule: "#2e432f", "rule-2": "#1d2b20", chrome: "#020402", "chrome-rule": "#000100",
        "chrome-accent": "#c6d86e", accent: "#c5d86b", "accent-2": "#94c27e", link: "#9adecc",
        warn: "#e29a70", ok: "#9bd08e", "good-border": "#547b58", "good-bg": "#142419",
        "warn-border": "#80623e", "warn-bg": "#2a2016", "warn-ink": "#e1bd78",
        "bar-fill": "#c6d86e", "row-hover": "#111a13",
      },
    },
    starlight: {
      light: {
        paper: "#f6f0fb", "paper-2": "#ede6f5", "paper-3": "#ddd2ea",
        plain: "#fffaff", "plain-soft": "#f8f3fc", "page-paper": "#fffaf0", "page-line": "#eadfca",
        rule: "#cabbd8", "rule-2": "#e5dcef", chrome: "#49345f", "chrome-rule": "#322143",
        "chrome-accent": "#d0ad62", accent: "#7a55a6", "accent-2": "#9d79c7", link: "#5c659d",
        warn: "#9a4f4f", ok: "#47724f", "good-border": "#a9cbb2", "good-bg": "#edf7ee",
        "warn-border": "#dcb2a2", "warn-bg": "#fff0ea", "warn-ink": "#824234",
        "bar-fill": "#a77ac8", "row-hover": "#f0e9f6",
      },
      dark: {
        paper: "#08050c", "paper-2": "#050308", "paper-3": "#16101b",
        plain: "#100b15", "plain-soft": "#0b0710", "page-paper": "#17111d", "page-line": "#2c2131",
        rule: "#35293b", "rule-2": "#241b2a", chrome: "#020104", "chrome-rule": "#000000",
        "chrome-accent": "#dcb967", accent: "#d9b868", "accent-2": "#ba99e9", link: "#a7d8d0",
        warn: "#e59564", ok: "#85c98f", "good-border": "#55795c", "good-bg": "#18271c",
        "warn-border": "#83683a", "warn-bg": "#2a2116", "warn-ink": "#edc874",
        "bar-fill": "#dcb967", "row-hover": "#17101d",
      },
    },
  };
  const themeMidpoints = {
    mist: {
      light: {
        paper: "#ffffff", "paper-2": "#f8fdff", "paper-3": "#edf8fb",
        plain: "#ffffff", "plain-soft": "#fcfeff", "page-paper": "#ffffff", "page-line": "#edf7fa",
        rule: "#dcecf0", "rule-2": "#f0f8fb", chrome: "#1b3d47", "chrome-rule": "#112a31",
        "chrome-accent": "#8fd3c5", accent: "#2a7f91", "accent-2": "#55aab5", link: "#236a7c",
        "bar-fill": "#58aeb8", "row-hover": "#f1fbfe",
      },
      dark: {
        paper: "#244047", "paper-2": "#172b32", "paper-3": "#2f515a",
        plain: "#29464e", "plain-soft": "#203941", "page-paper": "#304d55", "page-line": "#49666f",
        rule: "#52727c", "rule-2": "#3b5b65", chrome: "#081216", "chrome-rule": "#04090b",
        "chrome-accent": "#92ded1", accent: "#7ed0d8", "accent-2": "#6eb9c8", link: "#9fdae2",
        "bar-fill": "#78c6ce", "row-hover": "#2b4a52",
      },
    },
    lilac: {
      light: {
        paper: "#fffaff", "paper-2": "#f7f2fe", "paper-3": "#ede5f8",
        plain: "#ffffff", "plain-soft": "#fefcff", "page-paper": "#fffaff", "page-line": "#efe8f7",
        rule: "#ded3eb", "rule-2": "#f0e9f6", chrome: "#352b54", "chrome-rule": "#241b3d",
        "chrome-accent": "#a8d5b5", accent: "#7065ae", "accent-2": "#8c82cc", link: "#586aa8",
        "bar-fill": "#8d8bd0", "row-hover": "#f7f2fc",
      },
      dark: {
        paper: "#372a46", "paper-2": "#271e34", "paper-3": "#463757",
        plain: "#3d304d", "plain-soft": "#30243f", "page-paper": "#493a59", "page-line": "#625271",
        rule: "#6a5a7a", "rule-2": "#4e405e", chrome: "#100b19", "chrome-rule": "#09060f",
        "chrome-accent": "#c4dca8", accent: "#bcb4ff", "accent-2": "#a39be9", link: "#bec8ff",
        "bar-fill": "#b4abff", "row-hover": "#403150",
      },
    },
    glacier: {
      light: {
        paper: "#ffffff", "paper-2": "#f8fcff", "paper-3": "#edf6ff",
        plain: "#ffffff", "plain-soft": "#fcfeff", "page-paper": "#ffffff", "page-line": "#e0efff",
        rule: "#ccddf3", "rule-2": "#e8f2fb", chrome: "#1a3c70", "chrome-rule": "#0c254d",
        "chrome-accent": "#9bd2ff", accent: "#2169bf", "accent-2": "#428fee", link: "#2763ab",
        "bar-fill": "#5198f0", "row-hover": "#f2f8ff",
      },
      dark: {
        paper: "#19315c", "paper-2": "#112446", "paper-3": "#244476",
        plain: "#1d3768", "plain-soft": "#162b52", "page-paper": "#243f6f", "page-line": "#3b5886",
        rule: "#49679a", "rule-2": "#315080", chrome: "#071022", "chrome-rule": "#030711",
        "chrome-accent": "#9fd2ff", accent: "#96caff", "accent-2": "#79b3ef", link: "#addcff",
        "bar-fill": "#80bbff", "row-hover": "#203c6e",
      },
    },
    rose: {
      light: {
        paper: "#fffdfd", "paper-2": "#fbf3f6", "paper-3": "#f0e6eb",
        plain: "#ffffff", "plain-soft": "#fffbfd", "page-paper": "#fffef9", "page-line": "#f0e4da",
        rule: "#e1d3da", "rule-2": "#f2e8ed", chrome: "#432e38", "chrome-rule": "#2d1e25",
        "chrome-accent": "#e0b15f", accent: "#90556c", "accent-2": "#ba778e", link: "#536c84",
        "bar-fill": "#c38199", "row-hover": "#fbf4f7",
      },
      dark: {
        paper: "#3e2c37", "paper-2": "#30212a", "paper-3": "#503a47",
        plain: "#44313c", "plain-soft": "#382631", "page-paper": "#4b3542", "page-line": "#644d5a",
        rule: "#705965", "rule-2": "#523f4b", chrome: "#12090d", "chrome-rule": "#080405",
        "chrome-accent": "#e2bb71", accent: "#dfa6bc", "accent-2": "#c589a2", link: "#b0c9ec",
        "bar-fill": "#d493aa", "row-hover": "#46323d",
      },
    },
    sand: {
      light: {
        paper: "#fffefb", "paper-2": "#f8f4ed", "paper-3": "#ece3d3",
        plain: "#ffffff", "plain-soft": "#fffdfa", "page-paper": "#fffef9", "page-line": "#f0e4d2",
        rule: "#decfbe", "rule-2": "#efe7dd", chrome: "#342c22", "chrome-rule": "#211b14",
        "chrome-accent": "#caa85a", accent: "#74541d", "accent-2": "#9c7428", link: "#38616c",
        "bar-fill": "#a9873f", "row-hover": "#f8f3ea",
      },
      dark: {
        paper: "#393028", "paper-2": "#2b241d", "paper-3": "#483b2f",
        plain: "#3f352b", "plain-soft": "#342a22", "page-paper": "#473a2e", "page-line": "#5d4f40",
        rule: "#665747", "rule-2": "#4a3d30", chrome: "#100c08", "chrome-rule": "#070503",
        "chrome-accent": "#dab96d", accent: "#d5b061", "accent-2": "#bd9044", link: "#9bcbd6",
        "bar-fill": "#c99a4a", "row-hover": "#40352b",
      },
    },
    tidepool: {
      light: {
        paper: "#fcfffe", "paper-2": "#f3faf8", "paper-3": "#e3f0ec",
        plain: "#ffffff", "plain-soft": "#f9fdfb", "page-paper": "#fbfffc", "page-line": "#e2eee9",
        rule: "#ccdfda", "rule-2": "#e6f0ed", chrome: "#1b3d39", "chrome-rule": "#102b28",
        "chrome-accent": "#91ceb7", accent: "#287573", "accent-2": "#509692", link: "#216779",
        "bar-fill": "#56a19b", "row-hover": "#edf8f5",
      },
      dark: {
        paper: "#233d39", "paper-2": "#182d2a", "paper-3": "#2f504a",
        plain: "#28443f", "plain-soft": "#203934", "page-paper": "#2d4a45", "page-line": "#45645e",
        rule: "#4f716a", "rule-2": "#395850", chrome: "#07110f", "chrome-rule": "#030807",
        "chrome-accent": "#91dcc6", accent: "#84d3ca", "accent-2": "#65bdb3", link: "#a2e0dc",
        "bar-fill": "#77cbc4", "row-hover": "#2b4943",
      },
    },
    cypress: {
      light: {
        paper: "#f8fcf6", "paper-2": "#eef7ea", "paper-3": "#e1eed9",
        plain: "#ffffff", "plain-soft": "#f9fdf7", "page-paper": "#fffef4", "page-line": "#e5ead4",
        rule: "#d0e0c7", "rule-2": "#e6efe1", chrome: "#283d20", "chrome-rule": "#1a2a13",
        "chrome-accent": "#adbf52", accent: "#62772d", "accent-2": "#82983f", link: "#3c746d",
        "bar-fill": "#92a64e", "row-hover": "#f0f8ec",
      },
      dark: {
        paper: "#1f2d20", "paper-2": "#162118", "paper-3": "#2d3d2c",
        plain: "#243324", "plain-soft": "#1c2a1e", "page-paper": "#2d3b27", "page-line": "#44533d",
        rule: "#50654d", "rule-2": "#374835", chrome: "#060b06", "chrome-rule": "#020402",
        "chrome-accent": "#c6d86e", accent: "#c2d66a", "accent-2": "#98c681", link: "#9cdecc",
        "bar-fill": "#c6d86e", "row-hover": "#263726",
      },
    },
    starlight: {
      light: {
        paper: "#d8cce4", "paper-2": "#c7b8d5", "paper-3": "#e3d8ec",
        plain: "#f0e8f5", "plain-soft": "#dcd0e7", "page-paper": "#f6eef2", "page-line": "#d8c6d9",
        rule: "#b7a2c4", "rule-2": "#d0c0dc", chrome: "#402c54", "chrome-rule": "#2b1c39",
        "chrome-accent": "#d4b261", accent: "#7651a5", "accent-2": "#a17bc2", link: "#4f6592",
        "bar-fill": "#b38ac9", "row-hover": "#d2c3df",
      },
      dark: {
        paper: "#100b15", "paper-2": "#0b0710", "paper-3": "#1c1522",
        plain: "#15101a", "plain-soft": "#0f0a14", "page-paper": "#1a1420", "page-line": "#30253a",
        rule: "#3b3044", "rule-2": "#2b2232", chrome: "#040206", "chrome-rule": "#010102",
        "chrome-accent": "#dcb967", accent: "#d9b868", "accent-2": "#bda0ea", link: "#a9d9d2",
        "bar-fill": "#dcb967", "row-hover": "#18111e",
      },
    },
  };

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Theme changes should remain usable when storage is unavailable.
    }
  }

  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // No-op.
    }
  }

  function normalizeTheme(value) {
    if (value === "dark") return "starlight";
    if (value === "light" || value === "docket") return "sand";
    return themes.some((theme) => theme.id === value) ? value : "sand";
  }

  function normalizeLightness(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(-40, Math.min(40, Math.round(numeric)));
  }

  function selectedIndex() {
    const current = normalizeTheme(root.dataset.theme || readStorage(themeKey));
    return Math.max(0, themes.findIndex((theme) => theme.id === current));
  }

  function setCustomCss(cssText) {
    let style = document.getElementById("amyc-custom-css");
    if (!cssText.trim()) {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = "amyc-custom-css";
      document.head.appendChild(style);
    }
    style.textContent = cssText;
  }

  function parseColor(value) {
    const color = value.trim();
    const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const raw = hex[1].length === 3
        ? hex[1].split("").map((char) => `${char}${char}`).join("")
        : hex[1];
      return [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16));
    }
    const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgb) {
      return rgb.slice(1, 4).map((channel) => Number(channel));
    }
    return null;
  }

  function toRgb(color) {
    return `rgb(${color.map((channel) => Math.round(channel)).join(", ")})`;
  }

  function mixColor(color, target, amount) {
    return color.map((channel, index) => channel + (target[index] - channel) * amount);
  }

  function relativeLuminance(color) {
    const [r, g, b] = color.map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(a, b) {
    const light = Math.max(relativeLuminance(a), relativeLuminance(b));
    const dark = Math.min(relativeLuminance(a), relativeLuminance(b));
    return (light + 0.05) / (dark + 0.05);
  }

  function readableInk(background) {
    const dark = [31, 29, 27];
    const light = [244, 239, 231];
    return contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light;
  }

  function ensureContrast(color, background, minimum) {
    if (contrastRatio(color, background) >= minimum) return color;
    const darkTarget = [0, 0, 0];
    const lightTarget = [255, 255, 255];
    const target = contrastRatio(darkTarget, background) >= contrastRatio(lightTarget, background)
      ? darkTarget
      : lightTarget;
    let adjusted = color;
    for (let step = 0; step < 12 && contrastRatio(adjusted, background) < minimum; step += 1) {
      adjusted = mixColor(adjusted, target, 0.18);
    }
    return adjusted;
  }

  function setReadableTextTokens(adjusted, background, prefix) {
    const primary = readableInk(background);
    adjusted[prefix] = primary;
    adjusted[`${prefix}-2`] = mixColor(primary, background, 0.24);
    adjusted[`${prefix}-3`] = mixColor(primary, background, 0.48);
    adjusted[`${prefix}-4`] = mixColor(primary, background, 0.66);
  }

  function clearAdjustedTokens() {
    adjustableTokens.forEach((token) => root.style.removeProperty(`--${token}`));
  }

  function collectBaseTokens() {
    const styles = getComputedStyle(root);
    baseThemeTokens = {};
    adjustableTokens.forEach((token) => {
      baseThemeTokens[token] = styles.getPropertyValue(`--${token}`).trim();
    });
  }

  function applyLightness(value, persist) {
    currentLightness = normalizeLightness(value);
    if (persist) {
      writeStorage(lightnessKey, String(currentLightness));
    }

    clearAdjustedTokens();
    if (!currentLightness) {
      document.querySelectorAll("[data-theme-lightness]").forEach((input) => {
        input.value = "0";
      });
      document.querySelectorAll("[data-lightness-value]").forEach((node) => {
        node.textContent = "0";
      });
      return;
    }

    const direction = currentLightness > 0 ? "light" : "dark";
    const midpoint = themeMidpoints[root.dataset.theme]?.[direction] || {};
    const endpoint = themeVariants[root.dataset.theme]?.[direction] || {};
    const absoluteLightness = Math.abs(currentLightness);
    const firstLeg = absoluteLightness <= 20;
    const baseAmount = firstLeg ? absoluteLightness / 20 : (absoluteLightness - 20) / 20;
    const adjusted = {};
    adjustableTokens.forEach((token) => {
      const baseColor = parseColor(baseThemeTokens[token] || "");
      const midColor = parseColor(midpoint[token] || "");
      const endColor = parseColor(endpoint[token] || "");
      const source = firstLeg ? baseColor : (midColor || baseColor);
      const target = firstLeg ? (midColor || endColor) : endColor;
      if (source && target) adjusted[token] = mixColor(source, target, baseAmount);
    });

    const mainBackground = adjusted.paper || parseColor(baseThemeTokens.paper) || [255, 255, 255];
    const chromeBackground = adjusted.chrome || parseColor(baseThemeTokens.chrome) || [0, 0, 0];
    const warnBackground = adjusted["warn-bg"] || mainBackground;
    setReadableTextTokens(adjusted, mainBackground, "ink");
    adjusted["chrome-ink"] = ensureContrast(
      adjusted["chrome-ink"] || readableInk(chromeBackground),
      chromeBackground,
      5,
    );
    adjusted["chrome-accent"] = ensureContrast(
      adjusted["chrome-accent"] || adjusted.accent || readableInk(chromeBackground),
      chromeBackground,
      3,
    );
    ["accent", "accent-2", "link", "warn", "ok", "bar-fill"].forEach((token) => {
      if (adjusted[token]) {
        adjusted[token] = ensureContrast(adjusted[token], mainBackground, token === "link" ? 4.5 : 3);
      }
    });
    ["good-border", "warn-border"].forEach((token) => {
      if (adjusted[token]) {
        adjusted[token] = ensureContrast(adjusted[token], mainBackground, 2.4);
      }
    });
    if (adjusted["warn-ink"]) {
      adjusted["warn-ink"] = ensureContrast(adjusted["warn-ink"], warnBackground, 4.5);
    }
    Object.entries(adjusted).forEach(([token, color]) => {
      root.style.setProperty(`--${token}`, toRgb(color));
    });

    document.querySelectorAll("[data-theme-lightness]").forEach((input) => {
      input.value = String(currentLightness);
    });
    document.querySelectorAll("[data-lightness-value]").forEach((node) => {
      node.textContent = currentLightness > 0 ? `+${currentLightness}` : String(currentLightness);
    });
  }

  function applyTheme(themeId, persist) {
    const theme = themes.find((item) => item.id === themeId) || themes[0];
    clearAdjustedTokens();
    root.dataset.theme = theme.id;
    collectBaseTokens();
    if (metaTheme) {
      metaTheme.setAttribute("content", theme.themeColor);
    }
    if (persist) {
      writeStorage(themeKey, theme.id);
    }
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", `Theme spectrum: ${theme.name}`);
      button.setAttribute("title", `Theme spectrum: ${theme.name}`);
    });
    document.querySelectorAll("[data-theme-spectrum]").forEach((input) => {
      input.value = String(themes.indexOf(theme));
    });
    document.querySelectorAll("[data-theme-current]").forEach((node) => {
      node.textContent = theme.name;
    });
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.themeChoice === theme.id ? "true" : "false");
    });
    applyLightness(currentLightness, false);
  }

  function makeSwatch(theme) {
    const swatch = document.createElement("span");
    swatch.className = "theme-swatch";
    swatch.style.setProperty("--swatch-chrome", theme.colors[0]);
    swatch.style.setProperty("--swatch-paper-2", theme.colors[1]);
    swatch.style.setProperty("--swatch-accent", theme.colors[2]);
    swatch.style.setProperty("--swatch-plain", theme.colors[3]);
    swatch.style.setProperty("--swatch-rule", theme.colors[0]);
    for (let index = 0; index < 4; index += 1) {
      swatch.appendChild(document.createElement("span"));
    }
    return swatch;
  }

  function buildPanel(toggle, panelId) {
    const panel = document.createElement("div");
    panel.className = "theme-panel";
    panel.id = panelId;
    panel.hidden = true;
    panel.innerHTML = `
      <div class="theme-panel-head">
        <span>Theme</span>
        <span data-theme-current></span>
      </div>
      <div class="theme-control-grid">
        <div class="lightness-control">
          <span class="lightness-label">Light</span>
          <span class="lightness-slider-wrap">
            <input class="lightness-input" type="range" min="-40" max="40" step="1" data-theme-lightness aria-label="Theme lightness">
          </span>
          <span class="lightness-value" data-lightness-value>0</span>
          <span class="lightness-label">Dark</span>
        </div>
        <div class="theme-spectrum">
          <div class="theme-spectrum-row">
            <input class="theme-spectrum-input" type="range" min="0" max="${themes.length - 1}" step="1" data-theme-spectrum aria-label="Theme spectrum">
            <span class="theme-current" data-theme-current></span>
          </div>
          <div class="theme-options" data-theme-options></div>
        </div>
      </div>
      <details class="custom-css-box" data-custom-css-box>
        <summary class="custom-css-summary">
          <span>Custom CSS</span>
          <span class="custom-css-status" data-custom-css-status></span>
        </summary>
        <div class="custom-css-body">
          <textarea class="custom-css-input" id="${panelId}-css" data-custom-css spellcheck="false" aria-label="Custom CSS"></textarea>
          <div class="custom-css-actions">
            <button class="hbtn" type="button" data-custom-css-apply>Apply CSS</button>
            <button class="hbtn" type="button" data-custom-css-reset>Reset CSS</button>
          </div>
        </div>
      </details>
    `;

    const options = panel.querySelector("[data-theme-options]");
    themes.forEach((theme) => {
      const button = document.createElement("button");
      button.className = "theme-choice";
      button.type = "button";
      button.dataset.themeChoice = theme.id;
      button.appendChild(makeSwatch(theme));

      const copy = document.createElement("span");
      const name = document.createElement("span");
      const note = document.createElement("span");
      name.className = "theme-name";
      note.className = "theme-note";
      name.textContent = theme.name;
      note.textContent = theme.note;
      copy.append(name, note);
      button.appendChild(copy);
      button.addEventListener("click", () => {
        applyTheme(theme.id, true);
      });
      options.appendChild(button);
    });

    const spectrum = panel.querySelector("[data-theme-spectrum]");
    const lightness = panel.querySelector("[data-theme-lightness]");
    spectrum.addEventListener("input", () => {
      const theme = themes[Number(spectrum.value)] || themes[0];
      applyTheme(theme.id, true);
      const active = panel.querySelector(`[data-theme-choice="${theme.id}"]`);
      if (active) {
        active.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
    lightness.addEventListener("input", () => {
      applyLightness(lightness.value, true);
    });

    const cssInput = panel.querySelector("[data-custom-css]");
    const cssStatus = panel.querySelector("[data-custom-css-status]");
    cssInput.value = readStorage(customCssKey) || "";
    panel.querySelector("[data-custom-css-box]").open = !!cssInput.value.trim();
    panel.querySelector("[data-custom-css-apply]").addEventListener("click", () => {
      const value = cssInput.value;
      setCustomCss(value);
      writeStorage(customCssKey, value);
      applyTheme(root.dataset.theme, false);
      cssStatus.textContent = value.trim() ? "Custom CSS applied" : "Custom CSS cleared";
    });
    panel.querySelector("[data-custom-css-reset]").addEventListener("click", () => {
      cssInput.value = "";
      setCustomCss("");
      removeStorage(customCssKey);
      applyTheme(root.dataset.theme, false);
      cssStatus.textContent = "Custom CSS cleared";
    });

    toggle.after(panel);
    return panel;
  }

  const storedTheme = normalizeTheme(readStorage(themeKey));
  currentLightness = normalizeLightness(readStorage(lightnessKey));
  const storedCss = readStorage(customCssKey) || "";
  applyTheme(storedTheme, false);
  setCustomCss(storedCss);

  document.querySelectorAll("[data-theme-toggle]").forEach((toggle, index) => {
    const panel = buildPanel(toggle, `theme-panel-${index}`);
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", panel.id);

    toggle.addEventListener("click", () => {
      const willOpen = panel.hidden;
      document.querySelectorAll(".theme-panel").forEach((otherPanel) => {
        otherPanel.hidden = true;
      });
      document.querySelectorAll("[data-theme-toggle]").forEach((otherToggle) => {
        otherToggle.setAttribute("aria-expanded", "false");
      });
      panel.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen) {
        const input = panel.querySelector("[data-theme-spectrum]");
        if (input) input.focus();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".theme-panel") || event.target.closest("[data-theme-toggle]")) return;
    document.querySelectorAll(".theme-panel").forEach((panel) => {
      panel.hidden = true;
    });
    document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".theme-panel").forEach((panel) => {
      panel.hidden = true;
    });
    document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  applyTheme(themes[selectedIndex()].id, false);
})();
