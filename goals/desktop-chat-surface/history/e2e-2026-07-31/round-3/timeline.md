# Round 3 timeline

Clock: `beacon` (medium, residual 31 ms).
Times are video seconds; `seq` values are the witness sequence numbers to cite as `eventIds`.

## scenario: boot-chat-surface


- t=19.432 seq=28 marker scenario:boot-chat-surface

## scenario: create-thread


- t=19.550 seq=29 marker scenario:create-thread
- t=19.623 seq=30 pointer-enter [data-testid="sidebar-new"]
- t=19.623 seq=31 pointer-move @164,673
- t=19.623 seq=32 pointer-down [data-testid="sidebar-new"] @164,673
- t=19.628 seq=33 focus-in [data-testid="sidebar-new"]
- t=19.623 seq=34 pointer-up [data-testid="sidebar-new"] @164,673
- t=19.752 seq=35 transition start [data-testid="sidebar-new"]
- t=19.854 seq=36 transition end [data-testid="sidebar-new"]

## scenario: send-rich-message


- t=20.942 seq=37 marker scenario:send-rich-message
- t=21.012 seq=38 pointer-leave [data-testid="sidebar-new"]
- t=21.012 seq=39 pointer-enter div[role="combobox"][aria-label="Message composer"]
- t=21.012 seq=40 pointer-move @962,911
- t=21.012 seq=41 pointer-down div[role="combobox"][aria-label="Message composer"] > p:nth-of-type(1) @962,911
- t=21.014 seq=42 focus-out [data-testid="sidebar-new"]
- t=21.014 seq=43 focus-in div[role="combobox"][aria-label="Message composer"]
- t=21.012 seq=44 pointer-up div[role="combobox"][aria-label="Message composer"] > p:nth-of-type(1) @962,911
- t=21.082 seq=45 transition start [data-testid="composer"] > div:nth-of-type(1)
- t=21.082 seq=46 transition start [data-testid="composer"] > div:nth-of-type(1)
- t=21.082 seq=47 transition start [data-testid="composer"] > div:nth-of-type(1)
- t=21.082 seq=48 transition start [data-testid="composer"] > div:nth-of-type(1)
- t=21.082 seq=49 transition start [data-testid="sidebar-new"]
- t=21.208 seq=50 transition end [data-testid="composer"] > div:nth-of-type(1)
- t=21.208 seq=51 transition end [data-testid="composer"] > div:nth-of-type(1)
- t=21.208 seq=52 transition end [data-testid="composer"] > div:nth-of-type(1)
- t=21.208 seq=53 transition end [data-testid="composer"] > div:nth-of-type(1)
- t=21.208 seq=54 transition end [data-testid="sidebar-new"]
- t=25.904 seq=55 marker gesture:send-enter
- t=25.906 seq=56 key-down Enter
- t=25.935 seq=57 pointer-enter div[role="combobox"][aria-label="Message composer"]
- t=26.029 seq=58 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=26.029 seq=59 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=26.129 seq=60 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=26.129 seq=61 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=39.389 seq=62 scroll some("[data-testid=\"thread\"]")
- t=39.530 seq=63 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=39.530 seq=64 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=39.652 seq=65 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=39.652 seq=66 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)

## scenario: cancel-in-flight


- t=39.764 seq=67 marker scenario:cancel-in-flight
- t=39.791 seq=68 pointer-move @962,911
- t=39.791 seq=69 pointer-down div[role="combobox"][aria-label="Message composer"] > p:nth-of-type(1) @962,911
- t=39.791 seq=70 pointer-up div[role="combobox"][aria-label="Message composer"] > p:nth-of-type(1) @962,911
- t=44.280 seq=71 marker gesture:send-then-stop
- t=44.281 seq=72 key-down Enter
- t=44.309 seq=73 pointer-enter div[role="combobox"][aria-label="Message composer"]
- t=44.379 seq=74 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=44.379 seq=75 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=44.505 seq=76 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=44.505 seq=77 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=44.780 seq=78 marker gesture:click-stop
- t=44.853 seq=79 pointer-leave div[role="combobox"][aria-label="Message composer"]
- t=44.853 seq=80 pointer-enter [data-testid="turn-stop"]
- t=44.853 seq=81 pointer-move @380,784
- t=44.853 seq=82 pointer-down [data-testid="turn-stop"] @380,784
- t=44.856 seq=83 focus-out div[role="combobox"][aria-label="Message composer"]
- t=44.856 seq=84 focus-in [data-testid="turn-stop"]
- t=44.853 seq=85 pointer-up [data-testid="turn-stop"] @380,784
- t=44.862 seq=86 focus-out [data-testid="turn-stop"]
- t=44.888 seq=87 pointer-enter [data-testid="thinking"]
- t=44.850 seq=88 scroll some("[data-testid=\"thread\"]")
- t=44.922 seq=89 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=44.922 seq=90 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=44.922 seq=91 transition start [data-testid="composer"] > div:nth-of-type(1)
- t=44.922 seq=92 transition start [data-testid="composer"] > div:nth-of-type(1)
- t=44.922 seq=93 transition start [data-testid="composer"] > div:nth-of-type(1)
- t=44.922 seq=94 transition start [data-testid="composer"] > div:nth-of-type(1)
- t=45.064 seq=95 pointer-enter [data-testid="turn-assistant"] > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=45.032 seq=96 scroll some("[data-testid=\"thread\"]")
- t=45.064 seq=97 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=45.064 seq=98 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=45.064 seq=99 transition end [data-testid="composer"] > div:nth-of-type(1)
- t=45.064 seq=100 transition end [data-testid="composer"] > div:nth-of-type(1)
- t=45.064 seq=101 transition end [data-testid="composer"] > div:nth-of-type(1)
- t=45.064 seq=102 transition end [data-testid="composer"] > div:nth-of-type(1)

## scenario: edit-as-branch


- t=46.447 seq=103 marker scenario:edit-as-branch
- t=46.507 seq=104 pointer-leave [data-testid="turn-assistant"] > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)
- t=46.507 seq=105 pointer-enter [data-testid="turn-edit"]
- t=46.507 seq=106 pointer-move @668,727
- t=46.507 seq=107 pointer-down [data-testid="turn-edit"] @668,727
- t=46.509 seq=108 focus-in [data-testid="turn-edit"]
- t=46.507 seq=109 pointer-up [data-testid="turn-edit"] @668,727
- t=46.567 seq=110 transition start [data-testid="turn-edit"]
- t=46.726 seq=111 transition end [data-testid="turn-edit"]
- t=47.491 seq=112 pointer-leave [data-testid="turn-edit"]
- t=47.491 seq=113 pointer-enter div[role="combobox"][aria-label="Message composer"]
- t=47.491 seq=114 pointer-move @962,911
- t=47.491 seq=115 pointer-down div[role="combobox"][aria-label="Message composer"] > p:nth-of-type(1) > span:nth-of-type(1) @962,911
- t=47.493 seq=116 focus-out [data-testid="turn-edit"]
- t=47.493 seq=117 focus-in div[role="combobox"][aria-label="Message composer"]
- t=47.491 seq=118 pointer-up div[role="combobox"][aria-label="Message composer"] > p:nth-of-type(1) > span:nth-of-type(1) @962,911
- t=47.497 seq=119 key-down Control
- t=47.552 seq=120 transition start [data-testid="turn-edit"]
- t=47.552 seq=121 transition start [data-testid="composer"] > div:nth-of-type(2)
- t=47.552 seq=122 transition start [data-testid="composer"] > div:nth-of-type(2)
- t=47.552 seq=123 transition start [data-testid="composer"] > div:nth-of-type(2)
- t=47.552 seq=124 transition start [data-testid="composer"] > div:nth-of-type(2)
- t=47.685 seq=125 transition end [data-testid="turn-edit"]
- t=47.685 seq=126 transition end [data-testid="composer"] > div:nth-of-type(2)
- t=47.685 seq=127 transition end [data-testid="composer"] > div:nth-of-type(2)
- t=47.685 seq=128 transition end [data-testid="composer"] > div:nth-of-type(2)
- t=47.685 seq=129 transition end [data-testid="composer"] > div:nth-of-type(2)
- t=49.619 seq=130 marker gesture:rewrite-enter
- t=49.620 seq=131 key-down Enter
- t=49.632 seq=132 focus-out div[role="combobox"][aria-label="Message composer"]
- t=49.638 seq=133 pointer-enter div[role="combobox"][aria-label="Message composer"]
- t=53.549 seq=134 scroll some("[data-testid=\"thread\"]")
- t=53.631 seq=135 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=53.631 seq=136 transition start [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=53.785 seq=137 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)
- t=53.785 seq=138 transition end [data-testid="composer"] > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > button:nth-of-type(2)

## scenario: reload-history-intact


- t=54.311 seq=139 marker scenario:reload-history-intact
- t=57.479 seq=140 animation start [data-testid="chat-app"] > div:nth-of-type(1) > div:nth-of-type(1)
- t=57.479 seq=141 animation start [data-testid="chat-app"] > div:nth-of-type(1) > div:nth-of-type(1)
- t=57.479 seq=142 animation start [data-testid="chat-app"] > div:nth-of-type(1) > div:nth-of-type(2)
- t=57.479 seq=143 animation start [data-testid="chat-app"] > div:nth-of-type(1) > div:nth-of-type(3)
- t=57.880 seq=144 animation start [data-testid="chat-app"] > div:nth-of-type(1) > div:nth-of-type(2)
