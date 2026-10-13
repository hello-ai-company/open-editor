# Notes .23 — verified source application and page metadata outcomes

Local review candidate, based on immutable .22 / 60c37efee26f38765466f35ee897eabc5d688acd. Not published, pushed, merged or installed into PA. DB37 is excluded.

HTML Apply now reads the native block back before clearing its local draft. An editor transaction veto previously left the original body intact while silently dropping the pending source. A mismatching/deleted block now retains raw HTML/CSS/JS and the Notes cache with an alert; retry or explicit Cancel remains available. Delivered Apply closes and restores Edit source focus. Live preview remains draft-backed and is not proof of canonical application.

Card and ChildPage distinguish ready, loading, explicit missing, unbound metadata, fetch error, explicit restricted access and an empty reference. Unavailable/failed/restricted references are inert, with distinct status text alongside an existing local title hint. Non-ready metadata never projects images/previews. Existing page IDs/body props/legacy data remain unchanged. Store-backed mentions likewise remain inert for failed/unavailable/restricted reads. A failed display read does not automatically refetch on every render; hosts retry explicitly.

PA's confirmed native-focus scroll and absent pages provider are independent host corrections; see PA-CONTRACT and HOST-DELTA. PA's fastest preview/pointer timing path remains unresolved. This SDK check is not acceptance of all PA widgets or their persistence grants.
