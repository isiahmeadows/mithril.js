// Mithril v3 types

declare module "mithril/m" {
    interface Ref<T, IsNode extends boolean> {
        update(callback: (value: T, len?: number) => void | (() => void | Promise<void>)): void;
        update(this: Ref<T, true>, callback: (value: T, len?: number) => void | (() => void | Promise<void>)): void;
    }

    interface ContextSubtree<State> {
        update(newState?: State): Promise<void>;
        updateSync(newState?: State): Promise<void>;
    }

    interface Context<State> {
        isInit: boolean;
        update(newState?: State): Promise<void>;
        subtree(): ContextSubtree<State>;
        ref<T, IsNode extends boolean = false>(): Ref<T, IsNode>;
        ref(deps: Ref<unknown, boolean>[]): Ref<{
            [I in keyof typeof deps]:
                (typeof deps)[I] extends Ref<infer T, boolean> ? T : never
        }, false>;
        ref(deps: {[P in string | symbol]: Ref<unknown, boolean>}): Ref<{
            [I in keyof typeof deps]:
                (typeof deps)[I] extends Ref<infer T, boolean> ? T : never
        }, false>;
    }

    interface ElemAttrs {
        key?: PropertyKey;
        ref?: Ref<Node, true>;
        children?: Child[];
    }

    interface CustomAttrs<R> {
        key?: PropertyKey;
        ref?: Ref<R, false>;
        children?: Child[];
    }

    interface Vnode {
        mask: number;
        tag: string | Component<any, any, any> | undefined;
        attrs: ElemAttrs | CustomAttrs<any> | undefined;
        children: Child[] | undefined;
    }

    type Child =
        string | number | boolean | undefined | null |
        ChildArray | Vnode;
    interface ChildArray extends Array<Child> {}

    type Component<A extends CustomAttrs<R>, R, State> =
        | ((attrs: A, context: Context<any>) => (
            | ((attrs: A) => Child)
            | {view(attrs: A): Child, ref?: R}
        ))
        | ((attrs: A, context: Context<State>, state?: State) => (
            | Child
            | {next?: State, view: Child, ref?: R}
        ));
}
