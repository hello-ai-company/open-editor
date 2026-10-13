# Notes .26: actual table editing and durable raw input

Local, unpublished candidate for the shared portion of original #37 and #57. Built independently from accepted .25 plus the preserved DB37 WIP. Original repositories, older candidates, trial screens and PA host work are retained. This is not completion of the full 59-item plan or PA table adoption.

An optional versioned `tableEditing` registry mounts row creation and cell editing inside the actual `databaseView` table. A cell operation names one stable property ID. Creation fixes its row key once and sends entered properties only. Computed, compound, hosted and future property definitions stay read-only; unknown fields, hidden rows and the parent document are not projected into replacement writes.

The host's CAS journal stores unparsed input, original value, original resource/schema revisions, complete view/query identity and any exact submitted ticket. Invalid input, stale schema, storage failure, denial, conflict and unknown receipts retain this record. Hydration never rebases or auto-submits. An already submitted record can only query its fixed operation ID. Successful input removal requires a matching receipt, refreshed rows and exact journal removal.

The registry owns one resource editor per database across views. Enclosing page/tab/Split/layout and query changes drain input and check a captured generation after asynchronous work. IME input stays enabled in its composing surface while peer surfaces, submit and leave are blocked. Closing controls retains input; explicit discard is reviewed and cannot cancel an unknown receipt. Previous-view input can be reviewed without changing current view settings.

The existing .22-.25 widget input boundary and native Code clipboard/focus fixes are retained. The ordinary Notes flow remains unchanged when `tableEditing` is absent. See the PA contract before mounting this optional writer.

Acceptance evidence and limitations are in the accompanying verification and acceptance files. No publication, push, host installation, actual API/AI call, new grant or security-setting change is performed.
