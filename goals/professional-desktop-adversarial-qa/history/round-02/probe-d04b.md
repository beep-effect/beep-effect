# Probe D04b

## D04 console messages (verbatim, in order, including repeats)

none

## Console errors and warnings of any kind (verbatim, in order, including repeats)

Warnings:

```text
MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 close listeners added. Use emitter.setMaxListeners() to increase limit
MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 end listeners added. Use emitter.setMaxListeners() to increase limit
ObjectMultiplex - orphaned data for stream "app-init-liveness"
ObjectMultiplex - orphaned data for stream "app-init-liveness"
ObjectMultiplex - orphaned data for stream "background-liveness"
ObjectMultiplex - orphaned data for stream "background-liveness"
MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 close listeners added. Use emitter.setMaxListeners() to increase limit
MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 end listeners added. Use emitter.setMaxListeners() to increase limit
ObjectMultiplex - orphaned data for stream "app-init-liveness"
ObjectMultiplex - orphaned data for stream "app-init-liveness"
ObjectMultiplex - orphaned data for stream "background-liveness"
ObjectMultiplex - orphaned data for stream "background-liveness"
```

Errors:

none

## Network requests containing `worker`, `visualizer`, or `.ts`

none

## Graph UI text

Graph badge text:

```text
pending
```

Graph panel text:

```text
Worker projection pending
```

## Required answers

(a) Did `[D04] bridge mounted` appear? What did it say Worker was?

No. `[D04] bridge mounted` did not appear, so it did not log any value for Worker.

(b) Did `[D04] graph request` appear? How many times, and what did it log?

No. It appeared 0 times and logged nothing.

(c) Did `[D04] constructing worker` appear?

No.

(d) Any uncaught error anywhere? Quote it verbatim.

No uncaught error appeared.
