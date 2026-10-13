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
export type NotesIconCategory = "documents" | "work" | "technology" | "life" | "nature" | "travel" | "symbols" | "interface";
export type NotesLucideIcon = { id: string; category: NotesIconCategory; label: string; keywords: string; nodes: readonly (readonly [string, Readonly<Record<string,string | number>>])[] };
export const NOTES_LUCIDE_ICONS: readonly NotesLucideIcon[] = [
  {
    "id": "file-text",
    "category": "documents",
    "label": "file text",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
        }
      ],
      [
        "path",
        {
          "d": "M14 2v4a2 2 0 0 0 2 2h4"
        }
      ],
      [
        "path",
        {
          "d": "M10 9H8"
        }
      ],
      [
        "path",
        {
          "d": "M16 13H8"
        }
      ],
      [
        "path",
        {
          "d": "M16 17H8"
        }
      ]
    ]
  },
  {
    "id": "book-open",
    "category": "documents",
    "label": "book open",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "M12 7v14"
        }
      ],
      [
        "path",
        {
          "d": "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
        }
      ]
    ]
  },
  {
    "id": "notebook-pen",
    "category": "documents",
    "label": "notebook pen",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"
        }
      ],
      [
        "path",
        {
          "d": "M2 6h4"
        }
      ],
      [
        "path",
        {
          "d": "M2 10h4"
        }
      ],
      [
        "path",
        {
          "d": "M2 14h4"
        }
      ],
      [
        "path",
        {
          "d": "M2 18h4"
        }
      ],
      [
        "path",
        {
          "d": "M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"
        }
      ]
    ]
  },
  {
    "id": "clipboard-list",
    "category": "documents",
    "label": "clipboard list",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "rect",
        {
          "width": "8",
          "height": "4",
          "x": "8",
          "y": "2",
          "rx": "1",
          "ry": "1"
        }
      ],
      [
        "path",
        {
          "d": "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
        }
      ],
      [
        "path",
        {
          "d": "M12 11h4"
        }
      ],
      [
        "path",
        {
          "d": "M12 16h4"
        }
      ],
      [
        "path",
        {
          "d": "M8 11h.01"
        }
      ],
      [
        "path",
        {
          "d": "M8 16h.01"
        }
      ]
    ]
  },
  {
    "id": "library",
    "category": "documents",
    "label": "library",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "m16 6 4 14"
        }
      ],
      [
        "path",
        {
          "d": "M12 6v14"
        }
      ],
      [
        "path",
        {
          "d": "M8 8v12"
        }
      ],
      [
        "path",
        {
          "d": "M4 4v16"
        }
      ]
    ]
  },
  {
    "id": "folder-open",
    "category": "documents",
    "label": "folder open",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"
        }
      ]
    ]
  },
  {
    "id": "sticky-note",
    "category": "documents",
    "label": "sticky note",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"
        }
      ],
      [
        "path",
        {
          "d": "M15 3v4a2 2 0 0 0 2 2h4"
        }
      ]
    ]
  },
  {
    "id": "newspaper",
    "category": "documents",
    "label": "newspaper",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"
        }
      ],
      [
        "path",
        {
          "d": "M18 14h-8"
        }
      ],
      [
        "path",
        {
          "d": "M15 18h-5"
        }
      ],
      [
        "path",
        {
          "d": "M10 6h8v4h-8V6Z"
        }
      ]
    ]
  },
  {
    "id": "bookmark",
    "category": "documents",
    "label": "bookmark",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
        }
      ]
    ]
  },
  {
    "id": "graduation-cap",
    "category": "documents",
    "label": "graduation cap",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"
        }
      ],
      [
        "path",
        {
          "d": "M22 10v6"
        }
      ],
      [
        "path",
        {
          "d": "M6 12.5V16a6 3 0 0 0 12 0v-3.5"
        }
      ]
    ]
  },
  {
    "id": "pen-tool",
    "category": "documents",
    "label": "pen tool",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"
        }
      ],
      [
        "path",
        {
          "d": "m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"
        }
      ],
      [
        "path",
        {
          "d": "m2.3 2.3 7.286 7.286"
        }
      ],
      [
        "circle",
        {
          "cx": "11",
          "cy": "11",
          "r": "2"
        }
      ]
    ]
  },
  {
    "id": "highlighter",
    "category": "documents",
    "label": "highlighter",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "m9 11-6 6v3h9l3-3"
        }
      ],
      [
        "path",
        {
          "d": "m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"
        }
      ]
    ]
  },
  {
    "id": "receipt",
    "category": "documents",
    "label": "receipt",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"
        }
      ],
      [
        "path",
        {
          "d": "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"
        }
      ],
      [
        "path",
        {
          "d": "M12 17.5v-11"
        }
      ]
    ]
  },
  {
    "id": "scroll-text",
    "category": "documents",
    "label": "scroll text",
    "keywords": "文書 ノート 本 学習",
    "nodes": [
      [
        "path",
        {
          "d": "M15 12h-5"
        }
      ],
      [
        "path",
        {
          "d": "M15 8h-5"
        }
      ],
      [
        "path",
        {
          "d": "M19 17V5a2 2 0 0 0-2-2H4"
        }
      ],
      [
        "path",
        {
          "d": "M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"
        }
      ]
    ]
  },
  {
    "id": "briefcase-business",
    "category": "work",
    "label": "briefcase business",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M12 12h.01"
        }
      ],
      [
        "path",
        {
          "d": "M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"
        }
      ],
      [
        "path",
        {
          "d": "M22 13a18.15 18.15 0 0 1-20 0"
        }
      ],
      [
        "rect",
        {
          "width": "20",
          "height": "14",
          "x": "2",
          "y": "6",
          "rx": "2"
        }
      ]
    ]
  },
  {
    "id": "building-2",
    "category": "work",
    "label": "building 2",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"
        }
      ],
      [
        "path",
        {
          "d": "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"
        }
      ],
      [
        "path",
        {
          "d": "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"
        }
      ],
      [
        "path",
        {
          "d": "M10 6h4"
        }
      ],
      [
        "path",
        {
          "d": "M10 10h4"
        }
      ],
      [
        "path",
        {
          "d": "M10 14h4"
        }
      ],
      [
        "path",
        {
          "d": "M10 18h4"
        }
      ]
    ]
  },
  {
    "id": "chart-no-axes-combined",
    "category": "work",
    "label": "chart no axes combined",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M12 16v5"
        }
      ],
      [
        "path",
        {
          "d": "M16 14v7"
        }
      ],
      [
        "path",
        {
          "d": "M20 10v11"
        }
      ],
      [
        "path",
        {
          "d": "m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"
        }
      ],
      [
        "path",
        {
          "d": "M4 18v3"
        }
      ],
      [
        "path",
        {
          "d": "M8 14v7"
        }
      ]
    ]
  },
  {
    "id": "presentation",
    "category": "work",
    "label": "presentation",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M2 3h20"
        }
      ],
      [
        "path",
        {
          "d": "M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"
        }
      ],
      [
        "path",
        {
          "d": "m7 21 5-5 5 5"
        }
      ]
    ]
  },
  {
    "id": "target",
    "category": "work",
    "label": "target",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "6"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "2"
        }
      ]
    ]
  },
  {
    "id": "flag",
    "category": "work",
    "label": "flag",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
        }
      ],
      [
        "line",
        {
          "x1": "4",
          "x2": "4",
          "y1": "22",
          "y2": "15"
        }
      ]
    ]
  },
  {
    "id": "rocket",
    "category": "work",
    "label": "rocket",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"
        }
      ],
      [
        "path",
        {
          "d": "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"
        }
      ],
      [
        "path",
        {
          "d": "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"
        }
      ],
      [
        "path",
        {
          "d": "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
        }
      ]
    ]
  },
  {
    "id": "lightbulb",
    "category": "work",
    "label": "lightbulb",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
        }
      ],
      [
        "path",
        {
          "d": "M9 18h6"
        }
      ],
      [
        "path",
        {
          "d": "M10 22h4"
        }
      ]
    ]
  },
  {
    "id": "calendar-days",
    "category": "work",
    "label": "calendar days",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M8 2v4"
        }
      ],
      [
        "path",
        {
          "d": "M16 2v4"
        }
      ],
      [
        "rect",
        {
          "width": "18",
          "height": "18",
          "x": "3",
          "y": "4",
          "rx": "2"
        }
      ],
      [
        "path",
        {
          "d": "M3 10h18"
        }
      ],
      [
        "path",
        {
          "d": "M8 14h.01"
        }
      ],
      [
        "path",
        {
          "d": "M12 14h.01"
        }
      ],
      [
        "path",
        {
          "d": "M16 14h.01"
        }
      ],
      [
        "path",
        {
          "d": "M8 18h.01"
        }
      ],
      [
        "path",
        {
          "d": "M12 18h.01"
        }
      ],
      [
        "path",
        {
          "d": "M16 18h.01"
        }
      ]
    ]
  },
  {
    "id": "clock-3",
    "category": "work",
    "label": "clock 3",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "polyline",
        {
          "points": "12 6 12 12 16.5 12"
        }
      ]
    ]
  },
  {
    "id": "check-check",
    "category": "work",
    "label": "check check",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M18 6 7 17l-5-5"
        }
      ],
      [
        "path",
        {
          "d": "m22 10-7.5 7.5L13 16"
        }
      ]
    ]
  },
  {
    "id": "list-todo",
    "category": "work",
    "label": "list todo",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "rect",
        {
          "x": "3",
          "y": "5",
          "width": "6",
          "height": "6",
          "rx": "1"
        }
      ],
      [
        "path",
        {
          "d": "m3 17 2 2 4-4"
        }
      ],
      [
        "path",
        {
          "d": "M13 6h8"
        }
      ],
      [
        "path",
        {
          "d": "M13 12h8"
        }
      ],
      [
        "path",
        {
          "d": "M13 18h8"
        }
      ]
    ]
  },
  {
    "id": "mail",
    "category": "work",
    "label": "mail",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "rect",
        {
          "width": "20",
          "height": "16",
          "x": "2",
          "y": "4",
          "rx": "2"
        }
      ],
      [
        "path",
        {
          "d": "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
        }
      ]
    ]
  },
  {
    "id": "message-circle",
    "category": "work",
    "label": "message circle",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
        }
      ]
    ]
  },
  {
    "id": "users",
    "category": "work",
    "label": "users",
    "keywords": "仕事 計画 タスク 会議",
    "nodes": [
      [
        "path",
        {
          "d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        }
      ],
      [
        "circle",
        {
          "cx": "9",
          "cy": "7",
          "r": "4"
        }
      ],
      [
        "path",
        {
          "d": "M22 21v-2a4 4 0 0 0-3-3.87"
        }
      ],
      [
        "path",
        {
          "d": "M16 3.13a4 4 0 0 1 0 7.75"
        }
      ]
    ]
  },
  {
    "id": "code-2",
    "category": "technology",
    "label": "code 2",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "path",
        {
          "d": "m18 16 4-4-4-4"
        }
      ],
      [
        "path",
        {
          "d": "m6 8-4 4 4 4"
        }
      ],
      [
        "path",
        {
          "d": "m14.5 4-5 16"
        }
      ]
    ]
  },
  {
    "id": "terminal",
    "category": "technology",
    "label": "terminal",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "polyline",
        {
          "points": "4 17 10 11 4 5"
        }
      ],
      [
        "line",
        {
          "x1": "12",
          "x2": "20",
          "y1": "19",
          "y2": "19"
        }
      ]
    ]
  },
  {
    "id": "cpu",
    "category": "technology",
    "label": "cpu",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "rect",
        {
          "width": "16",
          "height": "16",
          "x": "4",
          "y": "4",
          "rx": "2"
        }
      ],
      [
        "rect",
        {
          "width": "6",
          "height": "6",
          "x": "9",
          "y": "9",
          "rx": "1"
        }
      ],
      [
        "path",
        {
          "d": "M15 2v2"
        }
      ],
      [
        "path",
        {
          "d": "M15 20v2"
        }
      ],
      [
        "path",
        {
          "d": "M2 15h2"
        }
      ],
      [
        "path",
        {
          "d": "M2 9h2"
        }
      ],
      [
        "path",
        {
          "d": "M20 15h2"
        }
      ],
      [
        "path",
        {
          "d": "M20 9h2"
        }
      ],
      [
        "path",
        {
          "d": "M9 2v2"
        }
      ],
      [
        "path",
        {
          "d": "M9 20v2"
        }
      ]
    ]
  },
  {
    "id": "database",
    "category": "technology",
    "label": "database",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "ellipse",
        {
          "cx": "12",
          "cy": "5",
          "rx": "9",
          "ry": "3"
        }
      ],
      [
        "path",
        {
          "d": "M3 5V19A9 3 0 0 0 21 19V5"
        }
      ],
      [
        "path",
        {
          "d": "M3 12A9 3 0 0 0 21 12"
        }
      ]
    ]
  },
  {
    "id": "network",
    "category": "technology",
    "label": "network",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "rect",
        {
          "x": "16",
          "y": "16",
          "width": "6",
          "height": "6",
          "rx": "1"
        }
      ],
      [
        "rect",
        {
          "x": "2",
          "y": "16",
          "width": "6",
          "height": "6",
          "rx": "1"
        }
      ],
      [
        "rect",
        {
          "x": "9",
          "y": "2",
          "width": "6",
          "height": "6",
          "rx": "1"
        }
      ],
      [
        "path",
        {
          "d": "M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"
        }
      ],
      [
        "path",
        {
          "d": "M12 12V8"
        }
      ]
    ]
  },
  {
    "id": "globe",
    "category": "technology",
    "label": "globe",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"
        }
      ],
      [
        "path",
        {
          "d": "M2 12h20"
        }
      ]
    ]
  },
  {
    "id": "server",
    "category": "technology",
    "label": "server",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "rect",
        {
          "width": "20",
          "height": "8",
          "x": "2",
          "y": "2",
          "rx": "2",
          "ry": "2"
        }
      ],
      [
        "rect",
        {
          "width": "20",
          "height": "8",
          "x": "2",
          "y": "14",
          "rx": "2",
          "ry": "2"
        }
      ],
      [
        "line",
        {
          "x1": "6",
          "x2": "6.01",
          "y1": "6",
          "y2": "6"
        }
      ],
      [
        "line",
        {
          "x1": "6",
          "x2": "6.01",
          "y1": "18",
          "y2": "18"
        }
      ]
    ]
  },
  {
    "id": "monitor",
    "category": "technology",
    "label": "monitor",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "rect",
        {
          "width": "20",
          "height": "14",
          "x": "2",
          "y": "3",
          "rx": "2"
        }
      ],
      [
        "line",
        {
          "x1": "8",
          "x2": "16",
          "y1": "21",
          "y2": "21"
        }
      ],
      [
        "line",
        {
          "x1": "12",
          "x2": "12",
          "y1": "17",
          "y2": "21"
        }
      ]
    ]
  },
  {
    "id": "laptop",
    "category": "technology",
    "label": "laptop",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "path",
        {
          "d": "M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"
        }
      ]
    ]
  },
  {
    "id": "smartphone",
    "category": "technology",
    "label": "smartphone",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "rect",
        {
          "width": "14",
          "height": "20",
          "x": "5",
          "y": "2",
          "rx": "2",
          "ry": "2"
        }
      ],
      [
        "path",
        {
          "d": "M12 18h.01"
        }
      ]
    ]
  },
  {
    "id": "camera",
    "category": "technology",
    "label": "camera",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "path",
        {
          "d": "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "13",
          "r": "3"
        }
      ]
    ]
  },
  {
    "id": "video",
    "category": "technology",
    "label": "video",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "path",
        {
          "d": "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"
        }
      ],
      [
        "rect",
        {
          "x": "2",
          "y": "6",
          "width": "14",
          "height": "12",
          "rx": "2"
        }
      ]
    ]
  },
  {
    "id": "headphones",
    "category": "technology",
    "label": "headphones",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "path",
        {
          "d": "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"
        }
      ]
    ]
  },
  {
    "id": "mic",
    "category": "technology",
    "label": "mic",
    "keywords": "技術 コード データベース メディア",
    "nodes": [
      [
        "path",
        {
          "d": "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
        }
      ],
      [
        "path",
        {
          "d": "M19 10v2a7 7 0 0 1-14 0v-2"
        }
      ],
      [
        "line",
        {
          "x1": "12",
          "x2": "12",
          "y1": "19",
          "y2": "22"
        }
      ]
    ]
  },
  {
    "id": "house",
    "category": "life",
    "label": "house",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
        }
      ],
      [
        "path",
        {
          "d": "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        }
      ]
    ]
  },
  {
    "id": "heart",
    "category": "life",
    "label": "heart",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        }
      ]
    ]
  },
  {
    "id": "smile",
    "category": "life",
    "label": "smile",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "M8 14s1.5 2 4 2 4-2 4-2"
        }
      ],
      [
        "line",
        {
          "x1": "9",
          "x2": "9.01",
          "y1": "9",
          "y2": "9"
        }
      ],
      [
        "line",
        {
          "x1": "15",
          "x2": "15.01",
          "y1": "9",
          "y2": "9"
        }
      ]
    ]
  },
  {
    "id": "coffee",
    "category": "life",
    "label": "coffee",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M10 2v2"
        }
      ],
      [
        "path",
        {
          "d": "M14 2v2"
        }
      ],
      [
        "path",
        {
          "d": "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"
        }
      ],
      [
        "path",
        {
          "d": "M6 2v2"
        }
      ]
    ]
  },
  {
    "id": "utensils",
    "category": "life",
    "label": "utensils",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"
        }
      ],
      [
        "path",
        {
          "d": "M7 2v20"
        }
      ],
      [
        "path",
        {
          "d": "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"
        }
      ]
    ]
  },
  {
    "id": "gift",
    "category": "life",
    "label": "gift",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "rect",
        {
          "x": "3",
          "y": "8",
          "width": "18",
          "height": "4",
          "rx": "1"
        }
      ],
      [
        "path",
        {
          "d": "M12 8v13"
        }
      ],
      [
        "path",
        {
          "d": "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"
        }
      ],
      [
        "path",
        {
          "d": "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"
        }
      ]
    ]
  },
  {
    "id": "music",
    "category": "life",
    "label": "music",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M9 18V5l12-2v13"
        }
      ],
      [
        "circle",
        {
          "cx": "6",
          "cy": "18",
          "r": "3"
        }
      ],
      [
        "circle",
        {
          "cx": "18",
          "cy": "16",
          "r": "3"
        }
      ]
    ]
  },
  {
    "id": "palette",
    "category": "life",
    "label": "palette",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "circle",
        {
          "cx": "13.5",
          "cy": "6.5",
          "r": ".5",
          "fill": "currentColor"
        }
      ],
      [
        "circle",
        {
          "cx": "17.5",
          "cy": "10.5",
          "r": ".5",
          "fill": "currentColor"
        }
      ],
      [
        "circle",
        {
          "cx": "8.5",
          "cy": "7.5",
          "r": ".5",
          "fill": "currentColor"
        }
      ],
      [
        "circle",
        {
          "cx": "6.5",
          "cy": "12.5",
          "r": ".5",
          "fill": "currentColor"
        }
      ],
      [
        "path",
        {
          "d": "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
        }
      ]
    ]
  },
  {
    "id": "clapperboard",
    "category": "life",
    "label": "clapperboard",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"
        }
      ],
      [
        "path",
        {
          "d": "m6.2 5.3 3.1 3.9"
        }
      ],
      [
        "path",
        {
          "d": "m12.4 3.4 3.1 4"
        }
      ],
      [
        "path",
        {
          "d": "M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
        }
      ]
    ]
  },
  {
    "id": "gamepad-2",
    "category": "life",
    "label": "gamepad 2",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "line",
        {
          "x1": "6",
          "x2": "10",
          "y1": "11",
          "y2": "11"
        }
      ],
      [
        "line",
        {
          "x1": "8",
          "x2": "8",
          "y1": "9",
          "y2": "13"
        }
      ],
      [
        "line",
        {
          "x1": "15",
          "x2": "15.01",
          "y1": "12",
          "y2": "12"
        }
      ],
      [
        "line",
        {
          "x1": "18",
          "x2": "18.01",
          "y1": "10",
          "y2": "10"
        }
      ],
      [
        "path",
        {
          "d": "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"
        }
      ]
    ]
  },
  {
    "id": "trophy",
    "category": "life",
    "label": "trophy",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M6 9H4.5a2.5 2.5 0 0 1 0-5H6"
        }
      ],
      [
        "path",
        {
          "d": "M18 9h1.5a2.5 2.5 0 0 0 0-5H18"
        }
      ],
      [
        "path",
        {
          "d": "M4 22h16"
        }
      ],
      [
        "path",
        {
          "d": "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"
        }
      ],
      [
        "path",
        {
          "d": "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"
        }
      ],
      [
        "path",
        {
          "d": "M18 2H6v7a6 6 0 0 0 12 0V2Z"
        }
      ]
    ]
  },
  {
    "id": "puzzle",
    "category": "life",
    "label": "puzzle",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"
        }
      ]
    ]
  },
  {
    "id": "wallet",
    "category": "life",
    "label": "wallet",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"
        }
      ],
      [
        "path",
        {
          "d": "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"
        }
      ]
    ]
  },
  {
    "id": "shopping-bag",
    "category": "life",
    "label": "shopping bag",
    "keywords": "生活 趣味 音楽 アート",
    "nodes": [
      [
        "path",
        {
          "d": "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"
        }
      ],
      [
        "path",
        {
          "d": "M3 6h18"
        }
      ],
      [
        "path",
        {
          "d": "M16 10a4 4 0 0 1-8 0"
        }
      ]
    ]
  },
  {
    "id": "sun",
    "category": "nature",
    "label": "sun",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "4"
        }
      ],
      [
        "path",
        {
          "d": "M12 2v2"
        }
      ],
      [
        "path",
        {
          "d": "M12 20v2"
        }
      ],
      [
        "path",
        {
          "d": "m4.93 4.93 1.41 1.41"
        }
      ],
      [
        "path",
        {
          "d": "m17.66 17.66 1.41 1.41"
        }
      ],
      [
        "path",
        {
          "d": "M2 12h2"
        }
      ],
      [
        "path",
        {
          "d": "M20 12h2"
        }
      ],
      [
        "path",
        {
          "d": "m6.34 17.66-1.41 1.41"
        }
      ],
      [
        "path",
        {
          "d": "m19.07 4.93-1.41 1.41"
        }
      ]
    ]
  },
  {
    "id": "moon",
    "category": "nature",
    "label": "moon",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
        }
      ]
    ]
  },
  {
    "id": "cloud",
    "category": "nature",
    "label": "cloud",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
        }
      ]
    ]
  },
  {
    "id": "cloud-rain",
    "category": "nature",
    "label": "cloud rain",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
        }
      ],
      [
        "path",
        {
          "d": "M16 14v6"
        }
      ],
      [
        "path",
        {
          "d": "M8 14v6"
        }
      ],
      [
        "path",
        {
          "d": "M12 16v6"
        }
      ]
    ]
  },
  {
    "id": "mountain",
    "category": "nature",
    "label": "mountain",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "m8 3 4 8 5-5 5 15H2L8 3z"
        }
      ]
    ]
  },
  {
    "id": "trees",
    "category": "nature",
    "label": "trees",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"
        }
      ],
      [
        "path",
        {
          "d": "M7 16v6"
        }
      ],
      [
        "path",
        {
          "d": "M13 19v3"
        }
      ],
      [
        "path",
        {
          "d": "M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"
        }
      ]
    ]
  },
  {
    "id": "flower-2",
    "category": "nature",
    "label": "flower 2",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "8",
          "r": "2"
        }
      ],
      [
        "path",
        {
          "d": "M12 10v12"
        }
      ],
      [
        "path",
        {
          "d": "M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"
        }
      ],
      [
        "path",
        {
          "d": "M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"
        }
      ]
    ]
  },
  {
    "id": "leaf",
    "category": "nature",
    "label": "leaf",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
        }
      ],
      [
        "path",
        {
          "d": "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
        }
      ]
    ]
  },
  {
    "id": "sprout",
    "category": "nature",
    "label": "sprout",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M7 20h10"
        }
      ],
      [
        "path",
        {
          "d": "M10 20c5.5-2.5.8-6.4 3-10"
        }
      ],
      [
        "path",
        {
          "d": "M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"
        }
      ],
      [
        "path",
        {
          "d": "M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"
        }
      ]
    ]
  },
  {
    "id": "paw-print",
    "category": "nature",
    "label": "paw print",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "circle",
        {
          "cx": "11",
          "cy": "4",
          "r": "2"
        }
      ],
      [
        "circle",
        {
          "cx": "18",
          "cy": "8",
          "r": "2"
        }
      ],
      [
        "circle",
        {
          "cx": "20",
          "cy": "16",
          "r": "2"
        }
      ],
      [
        "path",
        {
          "d": "M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"
        }
      ]
    ]
  },
  {
    "id": "fish",
    "category": "nature",
    "label": "fish",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"
        }
      ],
      [
        "path",
        {
          "d": "M18 12v.5"
        }
      ],
      [
        "path",
        {
          "d": "M16 17.93a9.77 9.77 0 0 1 0-11.86"
        }
      ],
      [
        "path",
        {
          "d": "M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"
        }
      ],
      [
        "path",
        {
          "d": "M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"
        }
      ],
      [
        "path",
        {
          "d": "m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"
        }
      ]
    ]
  },
  {
    "id": "bird",
    "category": "nature",
    "label": "bird",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M16 7h.01"
        }
      ],
      [
        "path",
        {
          "d": "M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"
        }
      ],
      [
        "path",
        {
          "d": "m20 7 2 .5-2 .5"
        }
      ],
      [
        "path",
        {
          "d": "M10 18v3"
        }
      ],
      [
        "path",
        {
          "d": "M14 17.75V21"
        }
      ],
      [
        "path",
        {
          "d": "M7 18a6 6 0 0 0 3.84-10.61"
        }
      ]
    ]
  },
  {
    "id": "flame",
    "category": "nature",
    "label": "flame",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        }
      ]
    ]
  },
  {
    "id": "droplet",
    "category": "nature",
    "label": "droplet",
    "keywords": "自然 天気 動物 花",
    "nodes": [
      [
        "path",
        {
          "d": "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"
        }
      ]
    ]
  },
  {
    "id": "compass",
    "category": "travel",
    "label": "compass",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ]
    ]
  },
  {
    "id": "map",
    "category": "travel",
    "label": "map",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"
        }
      ],
      [
        "path",
        {
          "d": "M15 5.764v15"
        }
      ],
      [
        "path",
        {
          "d": "M9 3.236v15"
        }
      ]
    ]
  },
  {
    "id": "map-pin",
    "category": "travel",
    "label": "map pin",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "10",
          "r": "3"
        }
      ]
    ]
  },
  {
    "id": "navigation",
    "category": "travel",
    "label": "navigation",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "polygon",
        {
          "points": "3 11 22 2 13 21 11 13 3 11"
        }
      ]
    ]
  },
  {
    "id": "plane",
    "category": "travel",
    "label": "plane",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
        }
      ]
    ]
  },
  {
    "id": "train-front",
    "category": "travel",
    "label": "train front",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "M8 3.1V7a4 4 0 0 0 8 0V3.1"
        }
      ],
      [
        "path",
        {
          "d": "m9 15-1-1"
        }
      ],
      [
        "path",
        {
          "d": "m15 15 1-1"
        }
      ],
      [
        "path",
        {
          "d": "M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"
        }
      ],
      [
        "path",
        {
          "d": "m8 19-2 3"
        }
      ],
      [
        "path",
        {
          "d": "m16 19 2 3"
        }
      ]
    ]
  },
  {
    "id": "car",
    "category": "travel",
    "label": "car",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
        }
      ],
      [
        "circle",
        {
          "cx": "7",
          "cy": "17",
          "r": "2"
        }
      ],
      [
        "path",
        {
          "d": "M9 17h6"
        }
      ],
      [
        "circle",
        {
          "cx": "17",
          "cy": "17",
          "r": "2"
        }
      ]
    ]
  },
  {
    "id": "bike",
    "category": "travel",
    "label": "bike",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "circle",
        {
          "cx": "18.5",
          "cy": "17.5",
          "r": "3.5"
        }
      ],
      [
        "circle",
        {
          "cx": "5.5",
          "cy": "17.5",
          "r": "3.5"
        }
      ],
      [
        "circle",
        {
          "cx": "15",
          "cy": "5",
          "r": "1"
        }
      ],
      [
        "path",
        {
          "d": "M12 17.5V14l-3-3 4-3 2 3h2"
        }
      ]
    ]
  },
  {
    "id": "ship",
    "category": "travel",
    "label": "ship",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "M12 10.189V14"
        }
      ],
      [
        "path",
        {
          "d": "M12 2v3"
        }
      ],
      [
        "path",
        {
          "d": "M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"
        }
      ],
      [
        "path",
        {
          "d": "M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"
        }
      ],
      [
        "path",
        {
          "d": "M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"
        }
      ]
    ]
  },
  {
    "id": "tent",
    "category": "travel",
    "label": "tent",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "M3.5 21 14 3"
        }
      ],
      [
        "path",
        {
          "d": "M20.5 21 10 3"
        }
      ],
      [
        "path",
        {
          "d": "M15.5 21 12 15l-3.5 6"
        }
      ],
      [
        "path",
        {
          "d": "M2 21h20"
        }
      ]
    ]
  },
  {
    "id": "luggage",
    "category": "travel",
    "label": "luggage",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"
        }
      ],
      [
        "path",
        {
          "d": "M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"
        }
      ],
      [
        "path",
        {
          "d": "M10 20h4"
        }
      ],
      [
        "circle",
        {
          "cx": "16",
          "cy": "20",
          "r": "2"
        }
      ],
      [
        "circle",
        {
          "cx": "8",
          "cy": "20",
          "r": "2"
        }
      ]
    ]
  },
  {
    "id": "ticket",
    "category": "travel",
    "label": "ticket",
    "keywords": "旅行 地図 交通",
    "nodes": [
      [
        "path",
        {
          "d": "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"
        }
      ],
      [
        "path",
        {
          "d": "M13 5v2"
        }
      ],
      [
        "path",
        {
          "d": "M13 17v2"
        }
      ],
      [
        "path",
        {
          "d": "M13 11v2"
        }
      ]
    ]
  },
  {
    "id": "star",
    "category": "symbols",
    "label": "star",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
        }
      ]
    ]
  },
  {
    "id": "circle-check",
    "category": "symbols",
    "label": "circle check",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "m9 12 2 2 4-4"
        }
      ]
    ]
  },
  {
    "id": "circle-help",
    "category": "symbols",
    "label": "circle help",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
        }
      ],
      [
        "path",
        {
          "d": "M12 17h.01"
        }
      ]
    ]
  },
  {
    "id": "shield-check",
    "category": "symbols",
    "label": "shield check",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
        }
      ],
      [
        "path",
        {
          "d": "m9 12 2 2 4-4"
        }
      ]
    ]
  },
  {
    "id": "lock-keyhole",
    "category": "symbols",
    "label": "lock keyhole",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "16",
          "r": "1"
        }
      ],
      [
        "rect",
        {
          "x": "3",
          "y": "10",
          "width": "18",
          "height": "12",
          "rx": "2"
        }
      ],
      [
        "path",
        {
          "d": "M7 10V7a5 5 0 0 1 10 0v3"
        }
      ]
    ]
  },
  {
    "id": "key-round",
    "category": "symbols",
    "label": "key round",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"
        }
      ],
      [
        "circle",
        {
          "cx": "16.5",
          "cy": "7.5",
          "r": ".5",
          "fill": "currentColor"
        }
      ]
    ]
  },
  {
    "id": "sparkles",
    "category": "symbols",
    "label": "sparkles",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        }
      ],
      [
        "path",
        {
          "d": "M20 3v4"
        }
      ],
      [
        "path",
        {
          "d": "M22 5h-4"
        }
      ],
      [
        "path",
        {
          "d": "M4 17v2"
        }
      ],
      [
        "path",
        {
          "d": "M5 18H3"
        }
      ]
    ]
  },
  {
    "id": "zap",
    "category": "symbols",
    "label": "zap",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
        }
      ]
    ]
  },
  {
    "id": "infinity",
    "category": "symbols",
    "label": "infinity",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"
        }
      ]
    ]
  },
  {
    "id": "anchor",
    "category": "symbols",
    "label": "anchor",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M12 22V8"
        }
      ],
      [
        "path",
        {
          "d": "M5 12H2a10 10 0 0 0 20 0h-3"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "5",
          "r": "3"
        }
      ]
    ]
  },
  {
    "id": "atom",
    "category": "symbols",
    "label": "atom",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "1"
        }
      ],
      [
        "path",
        {
          "d": "M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"
        }
      ],
      [
        "path",
        {
          "d": "M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"
        }
      ]
    ]
  },
  {
    "id": "hash",
    "category": "symbols",
    "label": "hash",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "line",
        {
          "x1": "4",
          "x2": "20",
          "y1": "9",
          "y2": "9"
        }
      ],
      [
        "line",
        {
          "x1": "4",
          "x2": "20",
          "y1": "15",
          "y2": "15"
        }
      ],
      [
        "line",
        {
          "x1": "10",
          "x2": "8",
          "y1": "3",
          "y2": "21"
        }
      ],
      [
        "line",
        {
          "x1": "16",
          "x2": "14",
          "y1": "3",
          "y2": "21"
        }
      ]
    ]
  },
  {
    "id": "tag",
    "category": "symbols",
    "label": "tag",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
        }
      ],
      [
        "circle",
        {
          "cx": "7.5",
          "cy": "7.5",
          "r": ".5",
          "fill": "currentColor"
        }
      ]
    ]
  },
  {
    "id": "gem",
    "category": "symbols",
    "label": "gem",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M6 3h12l4 6-10 13L2 9Z"
        }
      ],
      [
        "path",
        {
          "d": "M11 3 8 9l4 13 4-13-3-6"
        }
      ],
      [
        "path",
        {
          "d": "M2 9h20"
        }
      ]
    ]
  },
  {
    "id": "diamond",
    "category": "symbols",
    "label": "diamond",
    "keywords": "記号 マーク 星",
    "nodes": [
      [
        "path",
        {
          "d": "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"
        }
      ]
    ]
  },
  {
    "id": "refresh-cw",
    "category": "interface",
    "label": "refresh cw",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
        }
      ],
      [
        "path",
        {
          "d": "M21 3v5h-5"
        }
      ],
      [
        "path",
        {
          "d": "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
        }
      ],
      [
        "path",
        {
          "d": "M8 16H3v5"
        }
      ]
    ]
  },
  {
    "id": "list-filter",
    "category": "interface",
    "label": "list filter",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M3 6h18"
        }
      ],
      [
        "path",
        {
          "d": "M7 12h10"
        }
      ],
      [
        "path",
        {
          "d": "M10 18h4"
        }
      ]
    ]
  },
  {
    "id": "panels-top-left",
    "category": "interface",
    "label": "panels top left",
    "keywords": "画面 操作",
    "nodes": [
      [
        "rect",
        {
          "width": "18",
          "height": "18",
          "x": "3",
          "y": "3",
          "rx": "2"
        }
      ],
      [
        "path",
        {
          "d": "M3 9h18"
        }
      ],
      [
        "path",
        {
          "d": "M9 21V9"
        }
      ]
    ]
  },
  {
    "id": "monitor-play",
    "category": "interface",
    "label": "monitor play",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M10 7.75a.75.75 0 0 1 1.142-.638l3.664 2.249a.75.75 0 0 1 0 1.278l-3.664 2.25a.75.75 0 0 1-1.142-.64z"
        }
      ],
      [
        "path",
        {
          "d": "M12 17v4"
        }
      ],
      [
        "path",
        {
          "d": "M8 21h8"
        }
      ],
      [
        "rect",
        {
          "x": "2",
          "y": "3",
          "width": "20",
          "height": "14",
          "rx": "2"
        }
      ]
    ]
  },
  {
    "id": "plus",
    "category": "interface",
    "label": "plus",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M5 12h14"
        }
      ],
      [
        "path",
        {
          "d": "M12 5v14"
        }
      ]
    ]
  },
  {
    "id": "x",
    "category": "interface",
    "label": "x",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M18 6 6 18"
        }
      ],
      [
        "path",
        {
          "d": "m6 6 12 12"
        }
      ]
    ]
  },
  {
    "id": "chevron-right",
    "category": "interface",
    "label": "chevron right",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "m9 18 6-6-6-6"
        }
      ]
    ]
  },
  {
    "id": "info",
    "category": "interface",
    "label": "info",
    "keywords": "画面 操作",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "M12 16v-4"
        }
      ],
      [
        "path",
        {
          "d": "M12 8h.01"
        }
      ]
    ]
  },
  {
    "id": "maximize",
    "category": "interface",
    "label": "maximize",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M8 3H5a2 2 0 0 0-2 2v3"
        }
      ],
      [
        "path",
        {
          "d": "M21 8V5a2 2 0 0 0-2-2h-3"
        }
      ],
      [
        "path",
        {
          "d": "M3 16v3a2 2 0 0 0 2 2h3"
        }
      ],
      [
        "path",
        {
          "d": "M16 21h3a2 2 0 0 0 2-2v-3"
        }
      ]
    ]
  },
  {
    "id": "trash-2",
    "category": "interface",
    "label": "trash 2",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M3 6h18"
        }
      ],
      [
        "path",
        {
          "d": "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
        }
      ],
      [
        "path",
        {
          "d": "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
        }
      ],
      [
        "line",
        {
          "x1": "10",
          "x2": "10",
          "y1": "11",
          "y2": "17"
        }
      ],
      [
        "line",
        {
          "x1": "14",
          "x2": "14",
          "y1": "11",
          "y2": "17"
        }
      ]
    ]
  },
  {
    "id": "type",
    "category": "interface",
    "label": "type",
    "keywords": "画面 操作",
    "nodes": [
      [
        "polyline",
        {
          "points": "4 7 4 4 20 4 20 7"
        }
      ],
      [
        "line",
        {
          "x1": "9",
          "x2": "15",
          "y1": "20",
          "y2": "20"
        }
      ],
      [
        "line",
        {
          "x1": "12",
          "x2": "12",
          "y1": "4",
          "y2": "20"
        }
      ]
    ]
  },
  {
    "id": "link",
    "category": "interface",
    "label": "link",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        }
      ],
      [
        "path",
        {
          "d": "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        }
      ]
    ]
  },
  {
    "id": "image",
    "category": "interface",
    "label": "image",
    "keywords": "画面 操作",
    "nodes": [
      [
        "rect",
        {
          "width": "18",
          "height": "18",
          "x": "3",
          "y": "3",
          "rx": "2",
          "ry": "2"
        }
      ],
      [
        "circle",
        {
          "cx": "9",
          "cy": "9",
          "r": "2"
        }
      ],
      [
        "path",
        {
          "d": "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"
        }
      ]
    ]
  },
  {
    "id": "table-2",
    "category": "interface",
    "label": "table 2",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"
        }
      ]
    ]
  },
  {
    "id": "minus",
    "category": "interface",
    "label": "minus",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M5 12h14"
        }
      ]
    ]
  },
  {
    "id": "check",
    "category": "interface",
    "label": "check",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M20 6 9 17l-5-5"
        }
      ]
    ]
  },
  {
    "id": "mouse-pointer-2",
    "category": "interface",
    "label": "mouse pointer 2",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"
        }
      ]
    ]
  },
  {
    "id": "eraser",
    "category": "interface",
    "label": "eraser",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"
        }
      ],
      [
        "path",
        {
          "d": "M22 21H7"
        }
      ],
      [
        "path",
        {
          "d": "m5 11 9 9"
        }
      ]
    ]
  },
  {
    "id": "square",
    "category": "interface",
    "label": "square",
    "keywords": "画面 操作",
    "nodes": [
      [
        "rect",
        {
          "width": "18",
          "height": "18",
          "x": "3",
          "y": "3",
          "rx": "2"
        }
      ]
    ]
  },
  {
    "id": "circle",
    "category": "interface",
    "label": "circle",
    "keywords": "画面 操作",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ]
    ]
  },
  {
    "id": "undo-2",
    "category": "interface",
    "label": "undo 2",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M9 14 4 9l5-5"
        }
      ],
      [
        "path",
        {
          "d": "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"
        }
      ]
    ]
  },
  {
    "id": "redo-2",
    "category": "interface",
    "label": "redo 2",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "m15 14 5-5-5-5"
        }
      ],
      [
        "path",
        {
          "d": "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"
        }
      ]
    ]
  },
  {
    "id": "download",
    "category": "interface",
    "label": "download",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        }
      ],
      [
        "polyline",
        {
          "points": "7 10 12 15 17 10"
        }
      ],
      [
        "line",
        {
          "x1": "12",
          "x2": "12",
          "y1": "15",
          "y2": "3"
        }
      ]
    ]
  },
  {
    "id": "paperclip",
    "category": "interface",
    "label": "paperclip",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M13.234 20.252 21 12.3"
        }
      ],
      [
        "path",
        {
          "d": "m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486"
        }
      ]
    ]
  },
  {
    "id": "sigma",
    "category": "interface",
    "label": "sigma",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"
        }
      ]
    ]
  },
  {
    "id": "copy",
    "category": "interface",
    "label": "copy",
    "keywords": "画面 操作",
    "nodes": [
      [
        "rect",
        {
          "width": "14",
          "height": "14",
          "x": "8",
          "y": "8",
          "rx": "2",
          "ry": "2"
        }
      ],
      [
        "path",
        {
          "d": "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
        }
      ]
    ]
  },
  {
    "id": "images",
    "category": "interface",
    "label": "images",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M18 22H4a2 2 0 0 1-2-2V6"
        }
      ],
      [
        "path",
        {
          "d": "m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "8",
          "r": "2"
        }
      ],
      [
        "rect",
        {
          "width": "16",
          "height": "16",
          "x": "6",
          "y": "2",
          "rx": "2"
        }
      ]
    ]
  },
  {
    "id": "columns-3",
    "category": "interface",
    "label": "columns 3",
    "keywords": "画面 操作",
    "nodes": [
      [
        "rect",
        {
          "width": "18",
          "height": "18",
          "x": "3",
          "y": "3",
          "rx": "2"
        }
      ],
      [
        "path",
        {
          "d": "M9 3v18"
        }
      ],
      [
        "path",
        {
          "d": "M15 3v18"
        }
      ]
    ]
  },
  {
    "id": "columns-2",
    "category": "interface",
    "label": "columns 2",
    "keywords": "画面 操作",
    "nodes": [
      [
        "rect",
        {
          "width": "18",
          "height": "18",
          "x": "3",
          "y": "3",
          "rx": "2"
        }
      ],
      [
        "path",
        {
          "d": "M12 3v18"
        }
      ]
    ]
  },
  {
    "id": "separator-horizontal",
    "category": "interface",
    "label": "separator horizontal",
    "keywords": "画面 操作",
    "nodes": [
      [
        "line",
        {
          "x1": "3",
          "x2": "21",
          "y1": "12",
          "y2": "12"
        }
      ],
      [
        "polyline",
        {
          "points": "8 8 12 4 16 8"
        }
      ],
      [
        "polyline",
        {
          "points": "16 16 12 20 8 16"
        }
      ]
    ]
  },
  {
    "id": "file-minus-2",
    "category": "interface",
    "label": "file minus 2",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"
        }
      ],
      [
        "path",
        {
          "d": "M14 2v4a2 2 0 0 0 2 2h4"
        }
      ],
      [
        "path",
        {
          "d": "M3 15h6"
        }
      ]
    ]
  },
  {
    "id": "heading",
    "category": "interface",
    "label": "heading",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M6 12h12"
        }
      ],
      [
        "path",
        {
          "d": "M6 20V4"
        }
      ],
      [
        "path",
        {
          "d": "M18 20V4"
        }
      ]
    ]
  },
  {
    "id": "quote",
    "category": "interface",
    "label": "quote",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"
        }
      ],
      [
        "path",
        {
          "d": "M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"
        }
      ]
    ]
  },
  {
    "id": "list",
    "category": "interface",
    "label": "list",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M3 12h.01"
        }
      ],
      [
        "path",
        {
          "d": "M3 18h.01"
        }
      ],
      [
        "path",
        {
          "d": "M3 6h.01"
        }
      ],
      [
        "path",
        {
          "d": "M8 12h13"
        }
      ],
      [
        "path",
        {
          "d": "M8 18h13"
        }
      ],
      [
        "path",
        {
          "d": "M8 6h13"
        }
      ]
    ]
  },
  {
    "id": "list-ordered",
    "category": "interface",
    "label": "list ordered",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M10 12h11"
        }
      ],
      [
        "path",
        {
          "d": "M10 18h11"
        }
      ],
      [
        "path",
        {
          "d": "M10 6h11"
        }
      ],
      [
        "path",
        {
          "d": "M4 10h2"
        }
      ],
      [
        "path",
        {
          "d": "M4 6h1v4"
        }
      ],
      [
        "path",
        {
          "d": "M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"
        }
      ]
    ]
  },
  {
    "id": "align-left",
    "category": "interface",
    "label": "align left",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M15 12H3"
        }
      ],
      [
        "path",
        {
          "d": "M17 18H3"
        }
      ],
      [
        "path",
        {
          "d": "M21 6H3"
        }
      ]
    ]
  },
  {
    "id": "align-center",
    "category": "interface",
    "label": "align center",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M17 12H7"
        }
      ],
      [
        "path",
        {
          "d": "M19 18H5"
        }
      ],
      [
        "path",
        {
          "d": "M21 6H3"
        }
      ]
    ]
  },
  {
    "id": "align-right",
    "category": "interface",
    "label": "align right",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M21 12H9"
        }
      ],
      [
        "path",
        {
          "d": "M21 18H7"
        }
      ],
      [
        "path",
        {
          "d": "M21 6H3"
        }
      ]
    ]
  },
  {
    "id": "indent-increase",
    "category": "interface",
    "label": "indent increase",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M21 12H11"
        }
      ],
      [
        "path",
        {
          "d": "M21 18H11"
        }
      ],
      [
        "path",
        {
          "d": "M21 6H11"
        }
      ],
      [
        "path",
        {
          "d": "m3 8 4 4-4 4"
        }
      ]
    ]
  },
  {
    "id": "indent-decrease",
    "category": "interface",
    "label": "indent decrease",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M21 12H11"
        }
      ],
      [
        "path",
        {
          "d": "M21 18H11"
        }
      ],
      [
        "path",
        {
          "d": "M21 6H11"
        }
      ],
      [
        "path",
        {
          "d": "m7 8-4 4 4 4"
        }
      ]
    ]
  },
  {
    "id": "baseline",
    "category": "interface",
    "label": "baseline",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M4 20h16"
        }
      ],
      [
        "path",
        {
          "d": "m6 16 6-12 6 12"
        }
      ],
      [
        "path",
        {
          "d": "M8 12h8"
        }
      ]
    ]
  },
  {
    "id": "a-large-small",
    "category": "interface",
    "label": "a large small",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M21 14h-5"
        }
      ],
      [
        "path",
        {
          "d": "M16 16v-3.5a2.5 2.5 0 0 1 5 0V16"
        }
      ],
      [
        "path",
        {
          "d": "M4.5 13h6"
        }
      ],
      [
        "path",
        {
          "d": "m3 16 4.5-9 4.5 9"
        }
      ]
    ]
  },
  {
    "id": "remove-formatting",
    "category": "interface",
    "label": "remove formatting",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M4 7V4h16v3"
        }
      ],
      [
        "path",
        {
          "d": "M5 20h6"
        }
      ],
      [
        "path",
        {
          "d": "M13 4 8 20"
        }
      ],
      [
        "path",
        {
          "d": "m15 15 5 5"
        }
      ],
      [
        "path",
        {
          "d": "m20 15-5 5"
        }
      ]
    ]
  },
  {
    "id": "arrow-up",
    "category": "interface",
    "label": "arrow up",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "m5 12 7-7 7 7"
        }
      ],
      [
        "path",
        {
          "d": "M12 19V5"
        }
      ]
    ]
  },
  {
    "id": "arrow-down",
    "category": "interface",
    "label": "arrow down",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M12 5v14"
        }
      ],
      [
        "path",
        {
          "d": "m19 12-7 7-7-7"
        }
      ]
    ]
  },
  {
    "id": "arrow-up-to-line",
    "category": "interface",
    "label": "arrow up to line",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M5 3h14"
        }
      ],
      [
        "path",
        {
          "d": "m18 13-6-6-6 6"
        }
      ],
      [
        "path",
        {
          "d": "M12 7v14"
        }
      ]
    ]
  },
  {
    "id": "arrow-down-to-line",
    "category": "interface",
    "label": "arrow down to line",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M12 17V3"
        }
      ],
      [
        "path",
        {
          "d": "m6 11 6 6 6-6"
        }
      ],
      [
        "path",
        {
          "d": "M19 21H5"
        }
      ]
    ]
  },
  {
    "id": "eye",
    "category": "interface",
    "label": "eye",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "3"
        }
      ]
    ]
  },
  {
    "id": "eye-off",
    "category": "interface",
    "label": "eye off",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
        }
      ],
      [
        "path",
        {
          "d": "M14.084 14.158a3 3 0 0 1-4.242-4.242"
        }
      ],
      [
        "path",
        {
          "d": "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
        }
      ],
      [
        "path",
        {
          "d": "m2 2 20 20"
        }
      ]
    ]
  },
  {
    "id": "lock",
    "category": "interface",
    "label": "lock",
    "keywords": "画面 操作",
    "nodes": [
      [
        "rect",
        {
          "width": "18",
          "height": "11",
          "x": "3",
          "y": "11",
          "rx": "2",
          "ry": "2"
        }
      ],
      [
        "path",
        {
          "d": "M7 11V7a5 5 0 0 1 10 0v4"
        }
      ]
    ]
  },
  {
    "id": "lock-open",
    "category": "interface",
    "label": "lock open",
    "keywords": "画面 操作",
    "nodes": [
      [
        "rect",
        {
          "width": "18",
          "height": "11",
          "x": "3",
          "y": "11",
          "rx": "2",
          "ry": "2"
        }
      ],
      [
        "path",
        {
          "d": "M7 11V7a5 5 0 0 1 9.9-1"
        }
      ]
    ]
  },
  {
    "id": "move-horizontal",
    "category": "interface",
    "label": "move horizontal",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "m18 8 4 4-4 4"
        }
      ],
      [
        "path",
        {
          "d": "M2 12h20"
        }
      ],
      [
        "path",
        {
          "d": "m6 8-4 4 4 4"
        }
      ]
    ]
  },
  {
    "id": "square-pen",
    "category": "interface",
    "label": "square pen",
    "keywords": "画面 操作",
    "nodes": [
      [
        "path",
        {
          "d": "M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        }
      ],
      [
        "path",
        {
          "d": "M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"
        }
      ]
    ]
  }
];
export const NOTES_LUCIDE_BY_ID = new Map(NOTES_LUCIDE_ICONS.map(icon => [icon.id, icon]));
