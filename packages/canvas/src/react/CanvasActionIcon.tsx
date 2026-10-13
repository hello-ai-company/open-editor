/** @license Selected Lucide 0.468.0 SVG data.
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * MIT License (Feather-derived portions)
 * Copyright (c) 2013-2022 Cole Bemis
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

import { createElement, type ReactNode } from "react";
const shapes: Record<string, readonly (readonly [string, Readonly<Record<string, string | number>>])[]> = {"copy": [["rect", {"width": "14", "height": "14", "x": "8", "y": "8", "rx": "2", "ry": "2"}], ["path", {"d": "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]], "align-left": [["path", {"d": "M15 12H3"}], ["path", {"d": "M17 18H3"}], ["path", {"d": "M21 6H3"}]], "align-center": [["path", {"d": "M17 12H7"}], ["path", {"d": "M19 18H5"}], ["path", {"d": "M21 6H3"}]], "align-right": [["path", {"d": "M21 12H9"}], ["path", {"d": "M21 18H7"}], ["path", {"d": "M21 6H3"}]], "arrow-up": [["path", {"d": "m5 12 7-7 7 7"}], ["path", {"d": "M12 19V5"}]], "arrow-down": [["path", {"d": "M12 5v14"}], ["path", {"d": "m19 12-7 7-7-7"}]], "eye": [["path", {"d": "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}], ["circle", {"cx": "12", "cy": "12", "r": "3"}]], "eye-off": [["path", {"d": "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"}], ["path", {"d": "M14.084 14.158a3 3 0 0 1-4.242-4.242"}], ["path", {"d": "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"}], ["path", {"d": "m2 2 20 20"}]], "lock": [["rect", {"width": "18", "height": "11", "x": "3", "y": "11", "rx": "2", "ry": "2"}], ["path", {"d": "M7 11V7a5 5 0 0 1 10 0v4"}]], "move-horizontal": [["path", {"d": "m18 8 4 4-4 4"}], ["path", {"d": "M2 12h20"}], ["path", {"d": "m6 8-4 4 4 4"}]]};
const cache = new Map<string, ReactNode>();
export function CanvasActionIcon({ name }: { name: string }) {
  let nodes = cache.get(name);
  if (!nodes) { nodes = (shapes[name] ?? []).map(([tag, attrs], key) => createElement(tag, { ...attrs, key })); cache.set(name, nodes); }
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{nodes}</svg>;
}
