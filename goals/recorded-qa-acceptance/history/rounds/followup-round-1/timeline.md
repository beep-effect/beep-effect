# Round 1 timeline

Clock: `beacon` (high, residual 11.2 ms).
Times are video seconds; `seq` values are the witness sequence numbers to cite as `eventIds`.

## scenario: sash-selection-smear


- t=12.686 seq=16 marker scenario:sash-selection-smear
- t=12.691 seq=17 marker gesture:sash-drag-left-right
- t=12.696 seq=18 pointer-enter [data-testid="dockview-react"]
- t=12.696 seq=19 pointer-move @338,89
- t=12.697 seq=20 pointer-down [data-testid="dockview-react"] > div:nth-of-type(1) @338,89
- t=12.729 seq=21 pointer-move @303,89
- t=12.762 seq=22 pointer-move @280,89
- t=12.796 seq=23 pointer-move @257,89
- t=12.829 seq=24 pointer-move @234,89
- t=12.861 seq=25 pointer-move @211,89
- t=12.896 seq=26 pointer-move @188,89
- t=12.928 seq=27 pointer-move @164,89
- t=12.962 seq=28 pointer-move @141,89
- t=12.995 seq=29 pointer-move @118,89
- t=13.028 seq=30 pointer-move @95,89
- t=13.061 seq=31 pointer-move @72,89
- t=13.095 seq=32 pointer-move @49,89
- t=13.128 seq=33 pointer-move @26,89
- t=13.363 seq=34 pointer-move @33,89
- t=13.395 seq=35 pointer-move @88,89
- t=13.429 seq=36 pointer-move @125,89
- t=13.461 seq=37 pointer-move @163,89
- t=13.494 seq=38 pointer-move @200,89
- t=13.528 seq=39 pointer-move @237,89
- t=13.562 seq=40 pointer-move @274,89
- t=13.594 seq=41 pointer-move @311,89
- t=13.628 seq=42 pointer-move @348,89
- t=13.662 seq=43 pointer-move @385,89
- t=13.694 seq=44 pointer-move @423,89
- t=13.728 seq=45 pointer-move @460,89
- t=13.761 seq=46 pointer-move @497,89
- t=13.796 seq=47 pointer-move @534,89
- t=13.812 seq=48 pointer-up [data-testid="dockview-react"] > div:nth-of-type(1) @534,89
- t=13.812 seq=49 pointer-enter [data-testid="panel-story-constrained-neighbor-panel"]

## scenario: sash-pointercancel-reset


- t=14.241 seq=50 marker scenario:sash-pointercancel-reset
- t=14.244 seq=51 marker gesture:sash-pointercancel
- t=14.244 seq=52 pointer-leave [data-testid="panel-story-constrained-neighbor-panel"]
- t=14.244 seq=53 pointer-move @369,474
- t=14.258 seq=54 pointer-down [data-testid="dockview-react"] > div:nth-of-type(1) @369,474
- t=14.295 seq=55 pointer-move @342,474
- t=14.328 seq=56 pointer-move @325,474
- t=14.362 seq=57 pointer-move @307,474
- t=14.395 seq=58 pointer-move @289,474
- t=14.428 seq=59 pointer-move @272,474
- t=14.462 seq=60 pointer-move @254,474
- t=14.478 seq=61 pointer-move @245,474
- t=14.648 seq=62 pointer-cancel [data-testid="dockview-react"] > div:nth-of-type(1) @0,0
- t=14.905 seq=63 pointer-move @227,474
- t=14.926 seq=64 pointer-move @191,474
- t=14.959 seq=65 pointer-move @155,474
- t=14.992 seq=66 pointer-move @119,474
- t=15.026 seq=67 pointer-move @83,474
- t=15.042 seq=68 pointer-move @65,474
- t=15.362 seq=69 pointer-up [data-testid="dockview-react"] > div:nth-of-type(1) @65,474
- t=15.362 seq=70 pointer-enter [data-group-id="story-constrained"]
- t=17.823 seq=71 animation start html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=17.891 seq=72 animation cancel html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)

## scenario: tab-drag-ghost


- t=19.179 seq=73 marker scenario:tab-drag-ghost
- t=19.187 seq=74 marker gesture:tab-drag-to-editor
- t=19.187 seq=75 pointer-enter [data-panel-id="story-log"]
- t=19.187 seq=76 pointer-move @552,52
- t=19.189 seq=77 pointer-down [data-panel-id="story-log"] @552,52
- t=19.191 seq=78 focus-in [data-panel-id="story-log"]
- t=19.213 seq=79 pointer-move @562,62
- t=19.244 seq=80 pointer-move @569,69
- t=19.277 seq=81 pointer-move @576,76
- t=19.310 seq=82 pointer-move @567,94
- t=19.344 seq=83 pointer-move @540,125
- t=19.376 seq=84 pointer-move @514,155
- t=19.410 seq=85 pointer-move @488,185
- t=19.444 seq=86 pointer-move @462,216
- t=19.476 seq=87 pointer-move @435,246
- t=19.510 seq=88 pointer-move @409,277
- t=19.543 seq=89 pointer-move @383,307
- t=19.577 seq=90 pointer-move @357,337
- t=19.610 seq=91 pointer-move @330,368
- t=19.644 seq=92 pointer-move @304,398
- t=19.677 seq=93 pointer-move @278,428
- t=19.710 seq=94 pointer-move @252,459
- t=19.732 seq=95 pointer-move @239,474
- t=20.077 seq=96 pointer-up [data-panel-id="story-log"] @239,474
- t=20.084 seq=97 focus-out [data-panel-id="story-log"]
- t=20.077 seq=98 pointer-enter [data-group-id="story-editor"]
- t=23.292 seq=99 animation start html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=23.357 seq=100 animation cancel html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)

## scenario: floating-drag-resize

> FAILED ASSERTION: grip resize grows the pane (320x252 -> 320x252)

- t=24.589 seq=101 marker scenario:floating-drag-resize
- t=24.612 seq=102 marker gesture:floating-header-drag
- t=24.613 seq=103 pointer-enter [data-testid="dockview-react"]
- t=24.613 seq=104 pointer-move @314,143
- t=24.625 seq=105 pointer-down [data-testid="dockview-react"] > div:nth-of-type(1) > div:nth-of-type(1) @314,143
- t=24.661 seq=106 pointer-move @334,157
- t=24.709 seq=107 pointer-move @354,171
- t=24.755 seq=108 pointer-move @374,185
- t=24.810 seq=109 pointer-move @394,198
- t=24.874 seq=110 pointer-move @414,212
- t=24.926 seq=111 pointer-move @434,226
- t=24.980 seq=112 pointer-move @454,240
- t=25.045 seq=113 pointer-move @474,254
- t=25.089 seq=114 pointer-move @484,261
- t=25.140 seq=115 pointer-move @504,275
- t=25.208 seq=116 pointer-move @514,281
- t=25.286 seq=117 pointer-move @524,288
- t=25.333 seq=118 pointer-move @554,309
- t=25.364 seq=119 pointer-move @574,323
- t=25.380 seq=120 pointer-up [data-testid="dockview-react"] > div:nth-of-type(1) > div:nth-of-type(1) @574,323
- t=25.820 seq=121 marker gesture:floating-grip-resize
- t=25.821 seq=122 pointer-move @421,327
- t=25.825 seq=123 pointer-down [data-testid="dockview-react"] > div:nth-of-type(1) > div:nth-of-type(1) > span:nth-of-type(1) @421,327
- t=25.848 seq=124 pointer-move @433,335
- t=25.880 seq=125 pointer-move @445,343
- t=25.912 seq=126 pointer-move @458,351
- t=25.945 seq=127 pointer-move @470,359
- t=25.980 seq=128 pointer-move @482,367
- t=26.016 seq=129 pointer-move @494,376
- t=26.047 seq=130 pointer-move @506,384
- t=26.096 seq=131 pointer-move @525,396
- t=26.131 seq=132 pointer-move @537,404
- t=26.165 seq=133 pointer-move @549,412
- t=26.179 seq=134 pointer-move @555,416
- t=26.196 seq=135 pointer-up [data-testid="dockview-react"] > div:nth-of-type(1) > div:nth-of-type(1) @555,416
- t=30.057 seq=136 animation start html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=30.149 seq=137 animation cancel html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=30.209 seq=138 pointer-down [data-panel-id="story-quadrant-source-panel"] @41,39
- t=30.210 seq=139 focus-in [data-panel-id="story-quadrant-source-panel"]
- t=30.220 seq=140 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=30.221 seq=141 pointer-move @726,474
- t=30.270 seq=142 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=30.270 seq=143 pointer-move @1372,474
- t=30.295 seq=144 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=30.316 seq=145 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=30.317 seq=146 pointer-move @1065,880

## scenario: drop-quadrant-hover


- t=31.464 seq=147 marker scenario:drop-quadrant-hover
- t=31.537 seq=148 marker gesture:quadrant-hover-left
- t=31.547 seq=149 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=31.547 seq=150 pointer-move @53,52
- t=31.568 seq=151 pointer-down [data-panel-id="story-quadrant-source-panel"] @53,52
- t=31.608 seq=152 pointer-move @57,56
- t=31.648 seq=153 pointer-move @60,59
- t=31.712 seq=154 pointer-move @64,62
- t=31.761 seq=155 pointer-move @67,66
- t=31.795 seq=156 pointer-move @71,69
- t=31.837 seq=157 pointer-move @74,72
- t=31.875 seq=158 pointer-move @78,76
- t=31.935 seq=159 pointer-move @114,99
- t=31.981 seq=160 pointer-move @212,158
- t=32.011 seq=161 pointer-move @278,198
- t=32.043 seq=162 pointer-move @343,237
- t=32.076 seq=163 pointer-move @409,277
- t=32.110 seq=164 pointer-move @474,316
- t=32.142 seq=165 pointer-move @540,356
- t=32.177 seq=166 pointer-move @605,395
- t=32.209 seq=167 pointer-move @671,435
- t=32.242 seq=168 pointer-move @736,474
- t=32.733 seq=169 key-down Escape
- t=32.736 seq=170 pointer-up [data-panel-id="story-quadrant-source-panel"] @736,474
- t=32.736 seq=171 pointer-leave [data-panel-id="story-quadrant-source-panel"]
- t=32.736 seq=172 pointer-enter [data-group-id="story-quadrant-target"]
- t=32.992 seq=173 marker gesture:quadrant-hover-right
- t=32.994 seq=174 pointer-leave [data-group-id="story-quadrant-target"]
- t=32.994 seq=175 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=32.994 seq=176 pointer-move @53,52
- t=32.995 seq=177 pointer-down [data-panel-id="story-quadrant-source-panel"] @53,52
- t=33.027 seq=178 pointer-move @64,62
- t=33.059 seq=179 pointer-move @71,69
- t=33.092 seq=180 pointer-move @78,76
- t=33.126 seq=181 pointer-move @147,99
- t=33.159 seq=182 pointer-move @278,138
- t=33.200 seq=183 pointer-move @409,178
- t=33.242 seq=184 pointer-move @606,237
- t=33.292 seq=185 pointer-move @738,277
- t=33.333 seq=186 pointer-move @934,336
- t=33.420 seq=187 pointer-move @1131,395
- t=33.463 seq=188 pointer-move @1328,454
- t=34.081 seq=189 key-down Escape
- t=33.480 seq=190 pointer-move @1394,474
- t=34.129 seq=191 pointer-up [data-panel-id="story-quadrant-source-panel"] @1394,474
- t=34.129 seq=192 pointer-leave [data-panel-id="story-quadrant-source-panel"]
- t=34.129 seq=193 pointer-enter [data-group-id="story-quadrant-target"]
- t=34.458 seq=194 marker gesture:quadrant-hover-top
- t=34.465 seq=195 pointer-leave [data-group-id="story-quadrant-target"]
- t=34.465 seq=196 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=34.465 seq=197 pointer-move @53,52
- t=34.482 seq=198 pointer-down [data-panel-id="story-quadrant-source-panel"] @53,52
- t=34.515 seq=199 pointer-move @57,56
- t=34.559 seq=200 pointer-move @64,62
- t=34.601 seq=201 pointer-move @71,69
- t=34.652 seq=202 pointer-move @78,76
- t=34.714 seq=203 pointer-move @130,79
- t=34.775 seq=204 pointer-move @179,79
- t=34.810 seq=205 pointer-move @229,79
- t=34.861 seq=206 pointer-move @327,79
- t=34.897 seq=207 pointer-move @376,79
- t=34.952 seq=208 pointer-move @425,79
- t=35.035 seq=209 pointer-move @475,79
- t=35.101 seq=210 pointer-move @524,79
- t=35.170 seq=211 pointer-move @622,78
- t=35.204 seq=212 pointer-move @721,78
- t=35.240 seq=213 pointer-move @819,78
- t=35.276 seq=214 pointer-move @917,78
- t=35.309 seq=215 pointer-move @1016,78
- t=35.817 seq=216 key-down Escape
- t=35.326 seq=217 pointer-move @1065,78
- t=35.819 seq=218 pointer-up [data-panel-id="story-quadrant-source-panel"] @1065,78
- t=35.819 seq=219 pointer-leave [data-panel-id="story-quadrant-source-panel"]
- t=35.819 seq=220 pointer-enter [data-group-id="story-quadrant-target"]
- t=36.073 seq=221 marker gesture:quadrant-hover-bottom
- t=36.074 seq=222 pointer-leave [data-group-id="story-quadrant-target"]
- t=36.074 seq=223 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=36.074 seq=224 pointer-move @53,52
- t=36.075 seq=225 pointer-down [data-panel-id="story-quadrant-source-panel"] @53,52
- t=36.110 seq=226 pointer-move @64,62
- t=36.143 seq=227 pointer-move @71,69
- t=36.176 seq=228 pointer-move @78,76
- t=36.211 seq=229 pointer-move @130,120
- t=36.242 seq=230 pointer-move @229,202
- t=36.289 seq=231 pointer-move @327,285
- t=36.326 seq=232 pointer-move @475,408
- t=36.368 seq=233 pointer-move @573,491
- t=36.416 seq=234 pointer-move @721,614
- t=36.451 seq=235 pointer-move @819,696
- t=36.498 seq=236 pointer-move @967,820
- t=36.546 seq=237 pointer-move @1065,902
- t=37.091 seq=238 key-down Escape
- t=37.100 seq=239 pointer-up [data-panel-id="story-quadrant-source-panel"] @1065,902
- t=37.100 seq=240 pointer-leave [data-panel-id="story-quadrant-source-panel"]
- t=40.995 seq=241 animation start html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=41.150 seq=242 animation cancel html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)

## scenario: escape-cancels-tab-drag


- t=42.387 seq=243 marker scenario:escape-cancels-tab-drag
- t=42.415 seq=244 marker gesture:tab-drag-escape
- t=42.417 seq=245 pointer-enter [data-panel-id="story-brief"]
- t=42.417 seq=246 pointer-move @127,52
- t=42.419 seq=247 pointer-down [data-panel-id="story-brief"] @127,52
- t=42.422 seq=248 focus-in [data-panel-id="story-brief"]
- t=42.446 seq=249 pointer-move @137,62
- t=42.494 seq=250 pointer-move @148,72
- t=42.530 seq=251 pointer-move @155,79
- t=42.566 seq=252 pointer-move @232,101
- t=42.613 seq=253 pointer-move @348,133
- t=42.652 seq=254 pointer-move @425,155
- t=42.695 seq=255 pointer-move @542,187
- t=42.728 seq=256 pointer-move @619,209
- t=42.768 seq=257 pointer-move @696,231
- t=42.827 seq=258 pointer-move @774,252
- t=42.860 seq=259 pointer-move @851,274
- t=42.906 seq=260 pointer-move @890,285
- t=42.961 seq=261 pointer-move @929,296
- t=43.250 seq=262 key-down Escape
- t=43.455 seq=263 pointer-up [data-panel-id="story-brief"] @929,296
- t=43.455 seq=264 pointer-leave [data-panel-id="story-brief"]
- t=43.455 seq=265 pointer-enter [data-group-id="story-outline"]
