// Adds the jest-dom matchers (toBeInTheDocument, toHaveStyle, toHaveAttribute,
// toBeEmptyDOMElement, ...) to every test file that runs in a jsdom
// environment. Loaded via setupFilesAfterEach so it has no effect on the
// node-environment Mirror/safety suites that don't render React components.
require('@testing-library/jest-dom')
