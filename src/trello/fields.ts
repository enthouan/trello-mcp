export function includeRequiredFields(
  fields: string,
  requiredFields: readonly string[],
): string {
  const trimmedFields = fields.trim();
  if (trimmedFields.toLowerCase() === "all") {
    return trimmedFields;
  }

  const requestedFields = trimmedFields
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field.length > 0 && field.toLowerCase() !== "none");
  const requestedFieldSet = new Set(requestedFields);

  for (const requiredField of requiredFields) {
    if (!requestedFieldSet.has(requiredField)) {
      requestedFields.push(requiredField);
      requestedFieldSet.add(requiredField);
    }
  }

  return requestedFields.join(",");
}
