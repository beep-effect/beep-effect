# Round 1 timeline

Clock: `beacon` (high, residual 11.1 ms).
Times are video seconds; `seq` values are the witness sequence numbers to cite as `eventIds`.

## scenario: sash-selection-smear


- t=9.832 seq=16 marker scenario:sash-selection-smear
- t=9.838 seq=17 marker gesture:sash-drag-left-right
- t=9.840 seq=18 pointer-enter [data-testid="dockview-react"]
- t=9.840 seq=19 pointer-move @338,474
- t=9.842 seq=20 pointer-down [data-testid="dockview-react"] > div:nth-of-type(1) @338,474
- t=9.871 seq=21 pointer-move @303,474
- t=9.906 seq=22 pointer-move @280,474
- t=9.938 seq=23 pointer-move @257,474
- t=9.972 seq=24 pointer-move @234,474
- t=10.006 seq=25 pointer-move @211,474
- t=10.038 seq=26 pointer-move @188,474
- t=10.071 seq=27 pointer-move @164,474
- t=10.105 seq=28 pointer-move @141,474
- t=10.138 seq=29 pointer-move @118,474
- t=10.173 seq=30 pointer-move @95,474
- t=10.205 seq=31 pointer-move @72,474
- t=10.237 seq=32 pointer-move @49,474
- t=10.270 seq=33 pointer-move @26,474
- t=10.504 seq=34 pointer-move @33,474
- t=10.536 seq=35 pointer-move @88,474
- t=10.569 seq=36 pointer-move @125,474
- t=10.603 seq=37 pointer-move @163,474
- t=10.636 seq=38 pointer-move @200,474
- t=10.669 seq=39 pointer-move @237,474
- t=10.703 seq=40 pointer-move @274,474
- t=10.736 seq=41 pointer-move @311,474
- t=10.770 seq=42 pointer-move @348,474
- t=10.804 seq=43 pointer-move @385,474
- t=10.836 seq=44 pointer-move @423,474
- t=10.870 seq=45 pointer-move @460,474
- t=10.904 seq=46 pointer-move @497,474
- t=10.937 seq=47 pointer-move @534,474
- t=10.954 seq=48 pointer-up [data-testid="dockview-react"] > div:nth-of-type(1) @534,474
- t=10.954 seq=49 pointer-enter [data-group-id="story-constrained-neighbor"]

## scenario: sash-pointercancel-reset


- t=11.383 seq=50 marker scenario:sash-pointercancel-reset
- t=11.386 seq=51 marker gesture:sash-pointercancel
- t=11.386 seq=52 pointer-leave [data-group-id="story-constrained-neighbor"]
- t=11.386 seq=53 pointer-move @369,474
- t=11.399 seq=54 pointer-down [data-testid="dockview-react"] > div:nth-of-type(1) @369,474
- t=11.419 seq=55 pointer-move @351,474
- t=11.452 seq=56 pointer-move @334,474
- t=11.488 seq=57 pointer-move @316,474
- t=11.519 seq=58 pointer-move @298,474
- t=11.554 seq=59 pointer-move @280,474
- t=11.586 seq=60 pointer-move @263,474
- t=11.618 seq=61 pointer-move @245,474
- t=12.045 seq=62 pointer-move @227,474
- t=12.067 seq=63 pointer-move @173,474
- t=12.100 seq=64 pointer-move @137,474
- t=12.134 seq=65 pointer-move @101,474
- t=12.167 seq=66 pointer-move @65,474
- t=12.486 seq=67 pointer-up [data-testid="dockview-react"] > div:nth-of-type(1) @65,474
- t=12.486 seq=68 pointer-enter [data-group-id="story-constrained"]
- t=14.848 seq=69 animation start html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=14.901 seq=70 animation cancel html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)

## scenario: tab-drag-ghost


- t=16.128 seq=71 marker scenario:tab-drag-ghost
- t=16.135 seq=72 marker gesture:tab-drag-to-editor
- t=16.135 seq=73 pointer-enter [data-panel-id="story-log"]
- t=16.135 seq=74 pointer-move @552,52
- t=16.137 seq=75 pointer-down [data-panel-id="story-log"] @552,52
- t=16.170 seq=76 pointer-move @562,62
- t=16.200 seq=77 pointer-move @569,69
- t=16.233 seq=78 pointer-move @576,76
- t=16.268 seq=79 pointer-move @567,94
- t=16.300 seq=80 pointer-move @540,125
- t=16.334 seq=81 pointer-move @514,155
- t=16.367 seq=82 pointer-move @488,185
- t=16.401 seq=83 pointer-move @462,216
- t=16.434 seq=84 pointer-move @435,246
- t=16.467 seq=85 pointer-move @409,277
- t=16.500 seq=86 pointer-move @383,307
- t=16.534 seq=87 pointer-move @357,337
- t=16.567 seq=88 pointer-move @330,368
- t=16.602 seq=89 pointer-move @304,398
- t=16.634 seq=90 pointer-move @278,428
- t=16.669 seq=91 pointer-move @252,459
- t=16.684 seq=92 pointer-move @239,474
- t=17.025 seq=93 pointer-up [data-panel-id="story-log"] @239,474
- t=17.025 seq=94 pointer-enter [data-group-id="story-editor"]
- t=19.648 seq=95 animation start html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=19.724 seq=96 animation cancel html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)

## scenario: floating-drag-resize

> FAILED ASSERTION: grip resize grows the pane (320x252 -> 320x252)

- t=20.956 seq=97 marker scenario:floating-drag-resize
- t=20.965 seq=98 marker gesture:floating-header-drag
- t=20.965 seq=99 pointer-enter [data-testid="dockview-react"]
- t=20.965 seq=100 pointer-move @314,143
- t=20.967 seq=101 pointer-down [data-testid="dockview-react"] > div:nth-of-type(1) > div:nth-of-type(1) @314,143
- t=20.993 seq=102 pointer-move @334,157
- t=21.039 seq=103 pointer-move @364,178
- t=21.071 seq=104 pointer-move @384,191
- t=21.105 seq=105 pointer-move @404,205
- t=21.137 seq=106 pointer-move @424,219
- t=21.170 seq=107 pointer-move @444,233
- t=21.204 seq=108 pointer-move @464,247
- t=21.239 seq=109 pointer-move @484,261
- t=21.272 seq=110 pointer-move @504,275
- t=21.304 seq=111 pointer-move @524,288
- t=21.338 seq=112 pointer-move @544,302
- t=21.371 seq=113 pointer-move @564,316
- t=21.387 seq=114 pointer-move @574,323
- t=21.404 seq=115 pointer-up [data-testid="dockview-react"] > div:nth-of-type(1) > div:nth-of-type(1) @574,323
- t=21.844 seq=116 marker gesture:floating-grip-resize
- t=21.846 seq=117 pointer-move @421,327
- t=21.848 seq=118 pointer-down [data-testid="dockview-react"] > div:nth-of-type(1) > div:nth-of-type(1) > span:nth-of-type(1) @421,327
- t=21.871 seq=119 pointer-move @433,335
- t=21.904 seq=120 pointer-move @445,343
- t=21.937 seq=121 pointer-move @458,351
- t=21.970 seq=122 pointer-move @470,359
- t=22.004 seq=123 pointer-move @482,367
- t=22.038 seq=124 pointer-move @494,376
- t=22.071 seq=125 pointer-move @506,384
- t=22.103 seq=126 pointer-move @518,392
- t=22.137 seq=127 pointer-move @531,400
- t=22.170 seq=128 pointer-move @543,408
- t=22.203 seq=129 pointer-move @555,416
- t=22.222 seq=130 pointer-up [data-testid="dockview-react"] > div:nth-of-type(1) > div:nth-of-type(1) @555,416
- t=24.698 seq=131 animation start html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=24.765 seq=132 animation cancel html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=24.782 seq=133 pointer-down [data-panel-id="story-quadrant-source-panel"] @41,39
- t=24.785 seq=134 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=24.786 seq=135 pointer-move @726,474
- t=24.814 seq=136 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=24.833 seq=137 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=24.834 seq=138 pointer-move @1065,68
- t=24.852 seq=139 pointer-enter [data-panel-id="story-quadrant-source-panel"]

## scenario: drop-quadrant-hover


- t=26.055 seq=140 marker scenario:drop-quadrant-hover
- t=26.059 seq=141 marker gesture:quadrant-hover-left
- t=26.060 seq=142 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=26.060 seq=143 pointer-move @53,52
- t=26.062 seq=144 pointer-down [data-panel-id="story-quadrant-source-panel"] @53,52
- t=26.084 seq=145 pointer-move @60,59
- t=26.117 seq=146 pointer-move @67,66
- t=26.150 seq=147 pointer-move @74,72
- t=26.185 seq=148 pointer-move @81,79
- t=26.218 seq=149 pointer-move @147,119
- t=26.250 seq=150 pointer-move @212,158
- t=26.283 seq=151 pointer-move @278,198
- t=26.319 seq=152 pointer-move @343,237
- t=26.351 seq=153 pointer-move @409,277
- t=26.384 seq=154 pointer-move @474,316
- t=26.416 seq=155 pointer-move @540,356
- t=26.452 seq=156 pointer-move @605,395
- t=26.484 seq=157 pointer-move @671,435
- t=26.517 seq=158 pointer-move @736,474
- t=27.008 seq=159 key-down Escape
- t=27.011 seq=160 pointer-up [data-panel-id="story-quadrant-source-panel"] @736,474
- t=27.011 seq=161 pointer-leave [data-panel-id="story-quadrant-source-panel"]
- t=27.011 seq=162 pointer-enter [data-group-id="story-quadrant-target"]
- t=27.266 seq=163 marker gesture:quadrant-hover-right
- t=27.267 seq=164 pointer-leave [data-group-id="story-quadrant-target"]
- t=27.267 seq=165 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=27.267 seq=166 pointer-move @53,52
- t=27.268 seq=167 pointer-down [data-panel-id="story-quadrant-source-panel"] @53,52
- t=27.301 seq=168 pointer-move @64,62
- t=27.333 seq=169 pointer-move @71,69
- t=27.367 seq=170 pointer-move @78,76
- t=27.400 seq=171 pointer-move @147,99
- t=27.434 seq=172 pointer-move @278,138
- t=27.467 seq=173 pointer-move @409,178
- t=27.500 seq=174 pointer-move @541,217
- t=27.533 seq=175 pointer-move @672,257
- t=27.567 seq=176 pointer-move @803,296
- t=27.600 seq=177 pointer-move @934,336
- t=27.634 seq=178 pointer-move @1066,375
- t=27.668 seq=179 pointer-move @1197,415
- t=27.701 seq=180 pointer-move @1328,454
- t=28.213 seq=181 key-down Escape
- t=27.718 seq=182 pointer-move @1394,474
- t=28.217 seq=183 pointer-up [data-panel-id="story-quadrant-source-panel"] @1394,474
- t=28.217 seq=184 pointer-leave [data-panel-id="story-quadrant-source-panel"]
- t=28.217 seq=185 pointer-enter [data-group-id="story-quadrant-target"]
- t=28.471 seq=186 marker gesture:quadrant-hover-top
- t=28.472 seq=187 pointer-leave [data-group-id="story-quadrant-target"]
- t=28.472 seq=188 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=28.472 seq=189 pointer-move @53,52
- t=28.473 seq=190 pointer-down [data-panel-id="story-quadrant-source-panel"] @53,52
- t=28.501 seq=191 pointer-move @64,62
- t=28.534 seq=192 pointer-move @71,69
- t=28.568 seq=193 pointer-move @78,76
- t=28.600 seq=194 pointer-move @130,79
- t=28.633 seq=195 pointer-move @229,79
- t=28.667 seq=196 pointer-move @327,79
- t=28.700 seq=197 pointer-move @425,79
- t=28.733 seq=198 pointer-move @524,79
- t=28.767 seq=199 pointer-move @622,78
- t=28.800 seq=200 pointer-move @721,78
- t=28.834 seq=201 pointer-move @819,78
- t=28.867 seq=202 pointer-move @917,78
- t=28.900 seq=203 pointer-move @1016,78
- t=29.403 seq=204 key-down Escape
- t=28.916 seq=205 pointer-move @1065,78
- t=29.405 seq=206 pointer-up [data-panel-id="story-quadrant-source-panel"] @1065,78
- t=29.405 seq=207 pointer-leave [data-panel-id="story-quadrant-source-panel"]
- t=29.405 seq=208 pointer-enter [data-group-id="story-quadrant-target"]
- t=29.659 seq=209 marker gesture:quadrant-hover-bottom
- t=29.659 seq=210 pointer-leave [data-group-id="story-quadrant-target"]
- t=29.659 seq=211 pointer-enter [data-panel-id="story-quadrant-source-panel"]
- t=29.659 seq=212 pointer-move @53,52
- t=29.660 seq=213 pointer-down [data-panel-id="story-quadrant-source-panel"] @53,52
- t=29.684 seq=214 pointer-move @64,62
- t=29.717 seq=215 pointer-move @71,69
- t=29.750 seq=216 pointer-move @78,76
- t=29.783 seq=217 pointer-move @130,120
- t=29.817 seq=218 pointer-move @229,202
- t=29.850 seq=219 pointer-move @327,285
- t=29.884 seq=220 pointer-move @425,367
- t=29.917 seq=221 pointer-move @524,449
- t=29.951 seq=222 pointer-move @622,532
- t=29.983 seq=223 pointer-move @721,614
- t=30.017 seq=224 pointer-move @819,696
- t=30.050 seq=225 pointer-move @917,779
- t=30.083 seq=226 pointer-move @1016,861
- t=30.602 seq=227 key-down Escape
- t=30.100 seq=228 pointer-move @1065,902
- t=30.604 seq=229 pointer-up [data-panel-id="story-quadrant-source-panel"] @1065,902
- t=30.604 seq=230 pointer-leave [data-panel-id="story-quadrant-source-panel"]
- t=32.897 seq=231 animation start html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=32.954 seq=232 animation cancel html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)

## scenario: escape-cancels-tab-drag


- t=34.184 seq=233 marker scenario:escape-cancels-tab-drag
- t=34.190 seq=234 marker gesture:tab-drag-escape
- t=34.190 seq=235 pointer-enter [data-panel-id="story-brief"]
- t=34.190 seq=236 pointer-move @127,52
- t=34.191 seq=237 pointer-down [data-panel-id="story-brief"] @127,52
- t=34.219 seq=238 pointer-move @137,62
- t=34.249 seq=239 pointer-move @144,69
- t=34.283 seq=240 pointer-move @151,76
- t=34.317 seq=241 pointer-move @193,90
- t=34.349 seq=242 pointer-move @271,111
- t=34.383 seq=243 pointer-move @348,133
- t=34.416 seq=244 pointer-move @425,155
- t=34.450 seq=245 pointer-move @503,176
- t=34.483 seq=246 pointer-move @580,198
- t=34.516 seq=247 pointer-move @658,220
- t=34.550 seq=248 pointer-move @735,241
- t=34.583 seq=249 pointer-move @812,263
- t=34.616 seq=250 pointer-move @890,285
- t=34.901 seq=251 key-down Escape
- t=34.634 seq=252 pointer-move @929,296
- t=35.107 seq=253 pointer-up [data-panel-id="story-brief"] @929,296
- t=35.107 seq=254 pointer-leave [data-panel-id="story-brief"]
- t=35.107 seq=255 pointer-enter [data-group-id="story-outline"]
