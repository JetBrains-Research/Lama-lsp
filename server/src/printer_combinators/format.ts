interface Format {
  height: number;
  firstLineWidth: number;
  middleWidth: number;
  lastLineWidth: number;
  toText: (shift: number, text: string) => string;
}

function isLessThan(f1: Format, f2: Format): boolean {
  return (
    f1.firstLineWidth <= f2.firstLineWidth &&
    f1.middleWidth <= f2.middleWidth &&
    f1.lastLineWidth <= f2.lastLineWidth &&
    f1.height <= f2.height
  );
}

function compare(f1: Format, f2: Format): number {
  const lessThan1 = isLessThan(f1, f2);
  const lessThan2 = isLessThan(f2, f1);
  if (lessThan1 && !lessThan2) {
    return -1;
  } else if (!lessThan1 && lessThan2) {
    return 1;
  } else {
    return 0;
  }
}

const empty: Format = {
  height: 0,
  firstLineWidth: 0,
  middleWidth: 0,
  lastLineWidth: 0,
  toText: (s, t) => t,
};

function line(nt: string): Format {
  return {
    height: 1,
    firstLineWidth: nt.length,
    middleWidth: nt.length,
    lastLineWidth: nt.length,
    toText: (s, t) => nt + t,
  };
}

function sp(n: number): string {
  return ' '.repeat(n);
}

function listMax(lst: number[]): number {
  if (lst.length === 0) {
    throw new Error('Empty list as argument of listMax.');
  }
  return Math.max(...lst);
}

function addAbove(f1: Format, f2: Format): Format {
  if (f1.height === 0) return f2;
  if (f2.height === 0) return f1;

  const middleWidthNew = (() => {
    if (f1.height === 1 && f2.height === 1) return f1.firstLineWidth;
    if (f1.height === 1 && f2.height === 2) return f2.firstLineWidth;
    if (f1.height === 1 && f2.height > 2) return Math.max(f2.firstLineWidth, f2.middleWidth);
    if (f1.height === 2 && f2.height === 1) return f1.lastLineWidth;
    if (f1.height > 2 && f2.height === 1) return Math.max(f1.middleWidth, f1.lastLineWidth);
    return listMax([f1.middleWidth, f1.lastLineWidth, f2.firstLineWidth, f2.middleWidth]);
  })();

  return {
    height: f1.height + f2.height,
    firstLineWidth: f1.firstLineWidth,
    middleWidth: middleWidthNew,
    lastLineWidth: f2.lastLineWidth,
    toText: (s, t) => f1.toText(s, '\n' + sp(s) + f2.toText(s, t)),
  };
}

function addBeside(f1: Format, f2: Format): Format {
  if (f1.height === 0) return f2;
  if (f2.height === 0) return f1;

  const middleWidthNew = (() => {
    if (f1.height === 1 && f2.height <= 2) return f1.firstLineWidth + f2.firstLineWidth;
    if (f1.height === 1 && f2.height > 2) return f1.firstLineWidth + f2.middleWidth;
    if (f1.height === 2 && f2.height === 1) return f1.firstLineWidth;
    if (f1.height > 2 && f2.height === 1) return f1.middleWidth;
    return listMax([
      f1.middleWidth,
      f1.lastLineWidth + f2.firstLineWidth,
      f1.lastLineWidth + f2.middleWidth,
    ]);
  })();

  const firstLineWidthNew = f1.height === 1 ? f1.firstLineWidth + f2.firstLineWidth : f1.firstLineWidth;

  return {
    height: f1.height + f2.height - 1,
    firstLineWidth: firstLineWidthNew,
    middleWidth: middleWidthNew,
    lastLineWidth: f1.lastLineWidth + f2.lastLineWidth,
    toText: (s, t) => f1.toText(s, f2.toText(s + f1.lastLineWidth, t)),
  };
}

function addFill(f1: Format, f2: Format, shift: number): Format {
  if (f1.height === 0) return f2;
  if (f2.height === 0) return f1;

  const middleWidthNew = (() => {
    if (f1.height === 1 && f2.height <= 2) return f1.firstLineWidth + f2.firstLineWidth;
    if (f1.height === 1 && f2.height > 2) return shift + f2.middleWidth;
    if (f1.height === 2 && f2.height > 2) return Math.max(f1.lastLineWidth + f2.firstLineWidth, shift + f2.middleWidth);
    if (f1.height === 2 && f2.height === 1) return f1.firstLineWidth;
    if (f1.height > 2 && f2.height === 1) return f1.middleWidth;
    if (f1.height > 2 && f2.height === 2) return Math.max(f1.middleWidth, f1.lastLineWidth + f2.firstLineWidth);
    return listMax([
      f1.middleWidth,
      f1.lastLineWidth + f2.firstLineWidth,
      shift + f2.middleWidth,
    ]);
  })();

  const firstLineWidthNew = f1.height === 1 ? f1.firstLineWidth + f2.firstLineWidth : f1.firstLineWidth;
  const lastLineWidthNew = f2.height === 1 ? f2.lastLineWidth + f1.lastLineWidth : f2.lastLineWidth + shift;

  return {
    height: f1.height + f2.height - 1,
    firstLineWidth: firstLineWidthNew,
    middleWidth: middleWidthNew,
    lastLineWidth: lastLineWidthNew,
    toText: (s, t) => f1.toText(s, f2.toText(shift + s, t)),
  };
}

function toString(f: Format): string {
  return f.toText(0, '');
}

function totalWidth(f: Format): number {
  return listMax([f.firstLineWidth, f.middleWidth, f.lastLineWidth]);
}

function ofString(s: string): Format {
  const lines = s.split('\n');
  const lineFormats = lines.map(line);
  return lineFormats.reduce(addAbove, empty);
}

function indent(shift: number, f: Format): Format {
  return {
    height: f.height,
    firstLineWidth: shift + f.firstLineWidth,
    middleWidth: shift + f.middleWidth,
    lastLineWidth: shift + f.lastLineWidth,
    toText: (s, t) => sp(shift) + f.toText(shift + s, t),
  };
}

const concatBeside = (a: Format, b: Format) => addBeside(a, b);
const concatAbove = (a: Format, b: Format) => addAbove(a, b);
const concatFill = (a: Format, b: Format, shift: number) => addFill(a, b, shift);

export {
  Format,
  isLessThan,
  compare,
  empty,
  line,
  sp,
  listMax,
  addAbove,
  addBeside,
  addFill,
  toString,
  totalWidth,
  ofString,
  indent,
  concatBeside,
  concatAbove,
  concatFill,
};
