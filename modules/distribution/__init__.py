"""
Document Distribution and Registry for SANKET.
"""

from modules.distribution.registry import (
    register_document,
    get_document,
    get_document_by_package,
    list_inbox_documents,
    list_all_documents,
    authorize_document_access,
)

__all__ = [
    "register_document",
    "get_document",
    "get_document_by_package",
    "list_inbox_documents",
    "list_all_documents",
    "authorize_document_access",
]
