# BayServer for TypeScript

# 3.0.0

- [Core] Performes a significant overall refactoring.
- [Core] Introduces a multiplexer type to allow flexible configuration of the I/O multiplexing method.
- [Core] Adopts the CIDR format for specifying source IP control.
- [CGI] Introduce the maxProcesses parameter to allow control over the number of processes to be started.

# 2.3.4

- [core] Fixes some small bugs

# 2.3.3

- [core] Fixes the issue encountered when aborting GrandAgent.
- [core] Addresses potential issues arising from I/O errors.

# 2.3.2

- [core] Fixes memory leaks on exceptional code paths.

# 2.3.1

- [core] Fixes the issue of timeouts occurring when uploading large file

# 2.3.0

- [CGI] Supports "timeout" parameter. (The timed-out CGI processes are killed)
- [Core] Improves the memusage output
- [Core] Fixes some bugs

# 2.2.3

- Fixes some bugs

# 2.2.2

- First version
