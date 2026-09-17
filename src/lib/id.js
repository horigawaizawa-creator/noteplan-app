let counter = 0;

export function genId() {
  counter += 1;
  return (
    'id_' +
    Date.now().toString(36) +
    '_' +
    counter.toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 7)
  );
}
