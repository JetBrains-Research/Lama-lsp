import { Format, totalWidth, indent, empty, ofString, line, concatBeside, concatAbove, concatFill, listMax, compare, isLessThan } from './format';
import { flatten } from 'lodash';

type FormatList = Format[];

function cons<T>(a: T, lst: T[]): T[] {
  return [a].concat(lst);
}

function mapFilter<A, B>(mapf: (a: A) => B, filterf: (b: B) => boolean, l: A[]): B[] {
  return l.reduce((lst: B[], a: A) => {
    const b = mapf(a);
    if (filterf(b)) {
      return cons(b, lst);
    } else {
      return lst;
    }
  }, []);
}

function filterMap<A, B>(filterf: (a: A) => boolean, mapf: (a: A) => B, l: A[]): B[] {
  return l.reduce((lst: B[], a: A) => {
    if (filterf(a)) {
      return cons(mapf(a), lst);
    } else {
      return lst;
    }
  }, []);
}

function addGeneral(op: (f1: Format, f2: Format) => Format, width: number, fl: Format[], f: Format): Format[] {
  return mapFilter((f2) => op(f2, f), (f) => totalWidth(f) <= width, fl);
}

function filteri<T>(filterf: (index: number) => boolean, lst: T[]): T[] {
  const result: T[] = [];
  lst.reduce((n, a) => {
    if (filterf(n)) {
      result.push(a);
    }
    return n + 1;
  }, 0);
  return result;
}

function factorize(lst: Format[]): Format[] {
  const flags = new Array(lst.length).fill(true);
  lst.forEach((f1, i1) => {
    if (flags[i1]) {
      lst.forEach((f2, i2) => {
        if (i1 < i2 && flags[i2]) {
          if (isLessThan(f1, f2)) {
            flags[i2] = false;
          } else if (isLessThan(f2, f1)) {
            flags[i1] = false;
          }
        }
      });
    }
  });
  return filteri((i) => flags[i], lst);
}

function crossGeneral(op: (f1: Format, f2: Format) => Format, width: number, fl1: Format[], fl2: Format[]): Format[] {
  const crossLst = flatten(fl2.map((f2) => addGeneral(op, width, fl1, f2)));
  return factorize(crossLst);
}

interface T {
  width: number;
  lst: FormatList;
}

function shiftRight(shift: number, fs: T): T {
  return {
    width: fs.width,
    lst: filterMap(
      (f) => totalWidth(f) <= fs.width - shift,
      (f) => indent(shift, f),
      fs.lst
    ),
  };
}

let defaultWidth = 126;

export function updateDefaultWidth(x: number) {
  defaultWidth = x;
}

const initial: T = {
  width: defaultWidth,
  lst: [empty],
};

const blankLine: T = {
  width: defaultWidth,
  lst: [line('')],
};

function fromString(s: string): T {
  return {
    width: defaultWidth,
    lst: [ofString(s)],
  };
}

function filterByHeight(fs: T, n: number): T {
  return {
    width: fs.width,
    lst: fs.lst.filter((f) => f.height < n + 1),
  };
}

function concatBesideT(fs1: T, fs2: T): T {
  return {
    width: fs1.width,
    lst: crossGeneral(concatBeside, fs1.width, fs1.lst, fs2.lst),
  };
}

function concatBesideWithSpace(fs1: T, fs2: T): T {
  return concatBesideT(concatBesideT(fs1, fromString(' ')), fs2);
}

function concatAboveT(fs1: T, fs2: T): T {
  return {
    width: fs1.width,
    lst: crossGeneral(concatAbove, fs1.width, fs1.lst, fs2.lst),
  };
}

function concatAboveWithBlankLine(fs1: T, fs2: T): T {
  return concatAboveT(concatAboveT(fs1, blankLine), fs2);
}

function concatFillT(fs1: T, fs2: T, shift: number): T {
  return {
    width: fs1.width,
    lst: crossGeneral((fs, f) => concatFill(fs, f, shift), fs1.width, fs1.lst, fs2.lst),
  };
}

function choose(fs1: T, fs2: T): T {
  return {
    width: Math.max(fs1.width, fs2.width),
    lst: factorize(fs1.lst.concat(fs2.lst)),
  };
}

function pickBest(t: T): Format {
  if (t.lst.length === 0) {
    throw new Error('Empty set of strings to choose from');
  }
  return t.lst.reduce((best, f) => (f.height < best.height ? f : best), t.lst[0]);
}

function toString(t: T): string {
  return pickBest(t).toText(0, '');
}

export {
  cons,
  mapFilter,
  filterMap,
  addGeneral,
  filteri,
  factorize,
  crossGeneral,
  T,
  shiftRight as sr,
  defaultWidth,
  initial,
  blankLine,
  fromString as st,
  filterByHeight as h,
  concatBesideT as b,
  concatBesideWithSpace as bs,
  concatAboveT as ab,
  concatAboveWithBlankLine as abb,
  concatFillT as cf,
  choose,
  pickBest,
  toString,
};
