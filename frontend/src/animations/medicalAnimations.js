const palettes = {
  activity: { accent: "#1b8a6b", wash: "#e6f6f0" },
  appointments: { accent: "#0b5f8a", wash: "#e8f4f8" },
  calendar: { accent: "#c27a1b", wash: "#fff3df" },
  patients: { accent: "#168a70", wash: "#e6f6f0" },
  prescriptions: { accent: "#a84d63", wash: "#fcebed" },
  records: { accent: "#0b5f8a", wash: "#e8f4f8" },
  team: { accent: "#168a70", wash: "#e6f6f0" },
  tickets: { accent: "#9b6b16", wash: "#fff3df" },
};

const value = (k) => ({ a: 0, k });
const color = (hex) =>
  hex.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16) / 255).concat(1);

function transform(position, scale = value([100, 100, 100]), rotation = 0) {
  return {
    ty: "tr",
    p: value([...position, 0]),
    a: value([0, 0, 0]),
    s: scale,
    r: value(rotation),
    o: value(100),
    sk: value(0),
    sa: value(0),
  };
}

function fill(colorHex) {
  return {
    ty: "fl",
    c: value(color(colorHex)),
    o: value(100),
    r: 1,
    bm: 0,
    nm: "Fill",
  };
}

function stroke(colorHex, width = 2) {
  return {
    ty: "st",
    c: value(color(colorHex)),
    o: value(100),
    w: value(width),
    lc: 2,
    lj: 2,
    ml: 4,
    bm: 0,
    nm: "Stroke",
  };
}

function rectangle(name, width, height, position, colorHex, radius = 4, options = {}) {
  return {
    ty: "gr",
    nm: name,
    it: [
      {
        ty: "rc",
        d: 1,
        s: value([width, height]),
        p: value([0, 0]),
        r: value(radius),
        nm: `${name} Path`,
      },
      ...(colorHex ? [fill(colorHex)] : []),
      ...(options.stroke ? [stroke(options.stroke, options.strokeWidth)] : []),
      transform(position, options.scale, options.rotation),
    ],
  };
}

function ellipse(name, width, height, position, colorHex, options = {}) {
  return {
    ty: "gr",
    nm: name,
    it: [
      {
        ty: "el",
        d: 1,
        s: value([width, height]),
        p: value([0, 0]),
        nm: `${name} Path`,
      },
      ...(colorHex ? [fill(colorHex)] : []),
      ...(options.stroke ? [stroke(options.stroke, options.strokeWidth)] : []),
      transform(position, options.scale),
    ],
  };
}

function path(name, vertices, colorHex, width = 4) {
  const tangents = vertices.map(() => [0, 0]);
  return {
    ty: "gr",
    nm: name,
    it: [
      {
        ty: "sh",
        ks: value({
          i: tangents,
          o: tangents,
          v: vertices,
          c: false,
        }),
        nm: `${name} Path`,
      },
      stroke(colorHex, width),
      transform([0, 0]),
    ],
  };
}

function layer(ind, name, shapes) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: value(100),
      r: value(0),
      p: value([0, 0, 0]),
      a: value([0, 0, 0]),
      s: value([100, 100, 100]),
    },
    ao: 0,
    shapes,
    ip: 0,
    op: 72,
    st: 0,
    bm: 0,
  };
}

const pulseScale = {
  a: 1,
  k: [
    {
      t: 0,
      s: [94, 94, 100],
      e: [106, 106, 100],
      o: { x: 0.33, y: 0 },
      i: { x: 0.67, y: 1 },
    },
    {
      t: 18,
      s: [106, 106, 100],
      e: [100, 100, 100],
      o: { x: 0.33, y: 0 },
      i: { x: 0.67, y: 1 },
    },
    { t: 34, s: [100, 100, 100] },
  ],
};

const badgeScale = {
  a: 1,
  k: [
    {
      t: 0,
      s: [15, 15, 100],
      e: [112, 112, 100],
      o: { x: 0.33, y: 0 },
      i: { x: 0.67, y: 1 },
    },
    {
      t: 14,
      s: [112, 112, 100],
      e: [100, 100, 100],
      o: { x: 0.33, y: 0 },
      i: { x: 0.67, y: 1 },
    },
    { t: 26, s: [100, 100, 100] },
  ],
};

function symbolShapes(variant, accent, wash) {
  if (variant === "activity") {
    return [
      rectangle("Monitor", 112, 76, [110, 67], "#ffffff", 14, {
        stroke: "#cfe0e8",
        strokeWidth: 3,
      }),
      path(
        "Heartbeat",
        [
          [70, 68],
          [88, 68],
          [96, 56],
          [105, 82],
          [117, 48],
          [128, 69],
          [151, 69],
        ],
        accent,
        4
      ),
      rectangle("Monitor stand", 34, 5, [110, 116], "#bfd3dc", 3),
    ];
  }

  if (variant === "appointments" || variant === "calendar") {
    return [
      rectangle("Calendar", 82, 98, [110, 70], "#ffffff", 13, {
        stroke: "#cfe0e8",
        strokeWidth: 3,
      }),
      rectangle("Calendar header", 82, 24, [110, 37], accent, 10),
      rectangle("Calendar divider", 82, 3, [110, 50], "#cfe0e8", 1),
      ...[
        [93, 65],
        [110, 65],
        [127, 65],
        [93, 83],
        [127, 83],
      ].map(([x, y], index) =>
        rectangle(`Calendar day ${index + 1}`, 9, 9, [x, y], "#d7e8ee", 3)
      ),
      rectangle("Selected day", 9, 9, [110, 83], accent, 3),
      rectangle("Calendar binder left", 4, 14, [94, 22], "#ffffff", 2),
      rectangle("Calendar binder right", 4, 14, [126, 22], "#ffffff", 2),
      rectangle("Calendar check short", 4, 10, [104, 104], accent, 2, {
        rotation: -42,
      }),
      rectangle("Calendar check long", 4, 17, [114, 102], accent, 2, {
        rotation: 42,
      }),
    ];
  }

  if (variant === "team" || variant === "patients") {
    return [
      ellipse("Doctor head", 22, 22, [92, 54], wash, {
        stroke: accent,
        strokeWidth: 3,
      }),
      ellipse("Patient head", 22, 22, [129, 54], "#e8f4f8", {
        stroke: "#0b5f8a",
        strokeWidth: 3,
      }),
      ellipse("Doctor shoulders", 40, 26, [92, 91], accent),
      ellipse("Patient shoulders", 40, 26, [129, 91], "#0b5f8a"),
      rectangle("Medical plus vertical", 6, 23, [109, 112], "#ffffff", 3),
      rectangle("Medical plus horizontal", 23, 6, [109, 112], "#ffffff", 3),
    ];
  }

  return [
    rectangle("Medical record", 82, 100, [110, 68], "#ffffff", 13, {
      stroke: "#cfe0e8",
      strokeWidth: 3,
    }),
    rectangle("Record line one", 42, 4, [110, 47], "#bfd3dc"),
    rectangle("Record line two", 42, 4, [110, 59], "#bfd3dc"),
    rectangle("Record line three", 30, 4, [104, 71], "#bfd3dc"),
    rectangle("Medical cross vertical", 8, 29, [110, 94], accent, 3, {
      scale: pulseScale,
    }),
    rectangle("Medical cross horizontal", 29, 8, [110, 94], accent, 3, {
      scale: pulseScale,
    }),
  ];
}

export function createMedicalAnimation(variant = "records") {
  const { accent, wash } = palettes[variant] || palettes.records;
  const layers = [
    layer(1, "Soft medical background", [
      rectangle("Background", 212, 132, [110, 70], wash, 28),
      ellipse("Background sparkle one", 9, 9, [42, 40], "#ffffff"),
      ellipse("Background sparkle two", 8, 8, [178, 101], "#ffffff"),
    ]),
    layer(2, "Illustration", symbolShapes(variant, accent, wash)),
    layer(3, "Confirmation badge", [
      ellipse("Badge", 30, 30, [160, 100], "#ffffff", {
        stroke: accent,
        strokeWidth: 3,
        scale: badgeScale,
      }),
      rectangle("Check short", 4, 9, [156, 100], accent, 2, {
        rotation: -42,
        scale: badgeScale,
      }),
      rectangle("Check long", 4, 15, [164, 98], accent, 2, {
        rotation: 42,
        scale: badgeScale,
      }),
    ]),
  ];

  return {
    v: "5.7.4",
    fr: 24,
    ip: 0,
    op: 72,
    w: 220,
    h: 140,
    nm: `Bio Care Plus ${variant} illustration`,
    ddd: 0,
    assets: [],
    layers,
  };
}

export const medicalAnimations = Object.fromEntries(
  Object.keys(palettes).map((variant) => [
    variant,
    createMedicalAnimation(variant),
  ])
);
