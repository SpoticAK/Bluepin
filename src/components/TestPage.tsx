/**
 * @deprecated Scratch file-input test stub with zero importers. Deletion tracked in
 * docs/TESTING_PLAN.md Phase 1, after Phase 3 tests cover the live path.
 */
export default function TestPage() {
  return (
    <div style={{ padding: '50px' }}>
      <h1>Isolated File Input Test Page</h1>
      <br />
      <input type="file" id="test-file" />
    </div>
  );
}
