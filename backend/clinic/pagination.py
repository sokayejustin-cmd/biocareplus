from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Pagination par défaut de l'API.

    Le frontend lit uniquement la première page (``results``). La taille par
    défaut est donc volontairement large, et peut être ajustée avec
    ``?page_size=`` (plafonné à 1000).
    """

    page_size = 200
    page_size_query_param = "page_size"
    max_page_size = 1000
