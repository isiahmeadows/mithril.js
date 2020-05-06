import {
    Vnode, Component, VnodeAttributes, Environment, ComponentInfo
} from "./internal/vnode"

type ClosureBody<A extends VnodeAttributes> =
    (attrs: A, env: Environment) => Vnode

type ClosureInit<A extends VnodeAttributes> =
    (info: ComponentInfo<ClosureBody<A>>) => ClosureBody<A>

export function component<
    A extends VnodeAttributes,
    E extends Environment = Environment
>(
    body: ClosureInit<A>
): Component<A, ClosureBody<A>, E>
export function component<
    A extends VnodeAttributes,
    E extends Environment = Environment
>(
    name: string,
    body: ClosureInit<A>
): Component<A, ClosureBody<A>, E>
export function component<
    A extends VnodeAttributes,
    E extends Environment = Environment
>(
    name: string | ClosureInit<A>,
    body?: Maybe<ClosureInit<A>>
): Component<A, ClosureBody<A>, E> {
    if (body == null) {
        body = name as (info: ComponentInfo<ClosureBody<A>>) => ClosureBody<A>
        name = ""
    }

    function Comp(attrs: A, info: ComponentInfo<ClosureBody<A>>, env: E) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (info.state == null) info.state = body!(info)

        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore https://github.com/microsoft/TypeScript/issues/35866
        return (0, info.state)(attrs, env)
    }

    try {
        Object.defineProperty(Comp, "name", {value: name})
    } catch (e) {
        // ignore to gracefully degrade on IE
    }

    return Comp
}
