import {A, P} from "@beep/utils";
import {Fn, MutableHashSet as MutableHashSetSchema} from "@beep/schema";
import {SchemaUtils} from "@beep/schema";
import * as S from "effect/Schema";
import {$ScratchpadId} from "@beep/identity"
import {MutableHashSet} from "effect";

const $I = $ScratchpadId.create("dockview/Lifecycle.models");


export class Disposable extends S.Class<Disposable>($I`Disposable`)({
	dispose: Fn({output: S.Void}).pipe(S.mutableKey),
}, $I.annote("Disposable", {
	description: "Disposable resource",
})) {
	static readonly NONE: Disposable = Disposable.make({
		dispose:() => {},
	})

	static readonly from = (func: () => void): Disposable => Disposable.make({
		dispose: func,
	})
}

export class CompositeDisposable extends S.Class<CompositeDisposable>($I`CompositeDisposable`)({
	_: S.Struct({
		//
		disposables: MutableHashSetSchema(Disposable)
			.pipe(S.mutableKey, SchemaUtils.withKeyDefaults(MutableHashSet.empty<Disposable>())),
		isDisposed: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false), S.mutableKey),
	}).pipe(S.mutableKey),

}, $I.annote("CompositeDisposable", {
	description: "Composite disposable resource",
})) {
	readonly isDisposed = () => this._.isDisposed

	static readonly new = (...args: Disposable[]) => CompositeDisposable.make({
		_: {
			disposables: MutableHashSet.fromIterable(args),
		},
	})

	readonly addDisposables = (...args: Disposable[]): void => {
		A.forEach(args, (arg) => {
			MutableHashSet.add(this._.disposables, arg)
		})
	}

	readonly removeDisposable = (disposable: Disposable): void => {
		MutableHashSet.remove(this._.disposables, disposable)
	}

	readonly dispose = () => {
		if (this._.isDisposed) {
			return
		}
		this._.isDisposed = true
		A.forEach(A.fromIterable(this._.disposables), (disposable) => disposable.dispose())
		MutableHashSet.clear(this._.disposables)
	}
}

export class MutableDisposable extends Disposable.extend<MutableDisposable>($I`MutableDisposable`)(
	{},
	$I.annote("MutableDisposable", {
		description: "Mutable disposable resource",
	}),
) {
	private _disposable = Disposable.NONE

	set value(disposable: Disposable) {
		if (P.isNotUndefined(this._disposable)) {
			this._disposable.dispose()
		}
		this._disposable = disposable
	}
	public override dispose = (): void => {
		if (P.isNotUndefined(this._disposable)) {
			this._disposable.dispose();
			this._disposable = Disposable.NONE;
		}
	}
}