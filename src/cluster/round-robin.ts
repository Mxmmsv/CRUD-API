export function createRoundRobinSelector<T>(values: readonly T[]) {
  if (values.length === 0) {
    throw new Error("Round-robin selector requires at least one value");
  }

  let nextIndex = 0;

  return () => {
    const value = values[nextIndex];

    if (value === undefined) {
      throw new Error("Round-robin selector resolved an unexpected empty slot");
    }

    nextIndex = (nextIndex + 1) % values.length;

    return value;
  };
}
