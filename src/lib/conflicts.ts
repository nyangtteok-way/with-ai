export function sameFields<T extends object>(left: T, right: T) {
  return (Object.keys(left) as (keyof T)[]).every((key) =>
    Object.is(left[key], right[key]),
  );
}

export function reconcileFields<T extends object>(
  base: T,
  local: T,
  remote: T,
) {
  const fields = { ...local };
  const remoteChangedKeys: (keyof T)[] = [];
  const conflictingKeys: (keyof T)[] = [];

  for (const key of Object.keys(base) as (keyof T)[]) {
    if (Object.is(base[key], remote[key])) continue;

    remoteChangedKeys.push(key);
    if (Object.is(local[key], base[key])) {
      fields[key] = remote[key];
    } else if (!Object.is(local[key], remote[key])) {
      conflictingKeys.push(key);
    }
  }

  return { fields, remoteChangedKeys, conflictingKeys };
}
