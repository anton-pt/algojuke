import { GraphQLError } from "graphql";
import { LibraryService } from "../services/libraryService.js";
import {
  LibraryError,
  DuplicateItemError,
  TidalApiError,
  ErrorType,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { requireAuth, type GraphQLContext } from "../middleware/authGuard.js";

/**
 * Context type for library resolvers
 */
interface LibraryContext extends GraphQLContext {
  libraryService: LibraryService;
}

/**
 * GraphQL resolvers for library management
 */
export const libraryResolvers = {
  Query: {
    /**
     * Get all albums in the user's library, sorted alphabetically
     */
    getLibraryAlbums: async (
      _parent: unknown,
      _args: unknown,
      context: LibraryContext,
    ) => {
      requireAuth(context, "getLibraryAlbums");
      try {
        return await context.libraryService.getLibraryAlbums(context.userId);
      } catch (error) {
        logger.error("get_library_albums_resolver_error", {
          error: String(error),
        });
        throw new GraphQLError("Failed to fetch library albums", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Get all tracks in the user's library, sorted alphabetically
     */
    getLibraryTracks: async (
      _parent: unknown,
      _args: unknown,
      context: LibraryContext,
    ) => {
      requireAuth(context, "getLibraryTracks");
      try {
        return await context.libraryService.getLibraryTracks(context.userId);
      } catch (error) {
        logger.error("get_library_tracks_resolver_error", {
          error: String(error),
        });
        throw new GraphQLError("Failed to fetch library tracks", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Get a specific album from the library by ID
     */
    getLibraryAlbum: async (
      _parent: unknown,
      args: { id: string },
      context: LibraryContext,
    ) => {
      requireAuth(context, "getLibraryAlbum");
      try {
        return await context.libraryService.getLibraryAlbum(
          args.id,
          context.userId,
        );
      } catch (error) {
        logger.error("get_library_album_resolver_error", {
          id: args.id,
          error: String(error),
        });
        throw new GraphQLError("Failed to fetch library album", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Get a specific track from the library by ID
     */
    getLibraryTrack: async (
      _parent: unknown,
      args: { id: string },
      context: LibraryContext,
    ) => {
      requireAuth(context, "getLibraryTrack");
      try {
        return await context.libraryService.getLibraryTrack(
          args.id,
          context.userId,
        );
      } catch (error) {
        logger.error("get_library_track_resolver_error", {
          id: args.id,
          error: String(error),
        });
        throw new GraphQLError("Failed to fetch library track", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },

  Mutation: {
    /**
     * Add an album to the user's library
     * Returns union type: LibraryAlbum | DuplicateLibraryItemError | TidalApiUnavailableError
     */
    addAlbumToLibrary: async (
      _parent: unknown,
      args: { input: { tidalAlbumId: string } },
      context: LibraryContext,
    ) => {
      requireAuth(context, "addAlbumToLibrary");
      const { tidalAlbumId } = args.input;

      try {
        const album = await context.libraryService.addAlbumToLibrary(
          tidalAlbumId,
          context.userId,
        );
        return {
          __typename: "LibraryAlbum",
          ...album,
        };
      } catch (error) {
        if (error instanceof DuplicateItemError) {
          return {
            __typename: "DuplicateLibraryItemError",
            message: error.message,
            existingItemId: error.existingItemId,
          };
        }

        if (error instanceof TidalApiError) {
          return {
            __typename: "TidalApiUnavailableError",
            message: error.message,
            retryable: error.retryable,
          };
        }

        logger.error("add_album_to_library_resolver_error", {
          tidalAlbumId,
          error: String(error),
        });

        // Generic error - return as TidalApiUnavailableError with retryable: false
        return {
          __typename: "TidalApiUnavailableError",
          message: "An unexpected error occurred while adding album to library",
          retryable: false,
        };
      }
    },

    /**
     * Add a track to the user's library
     * Returns union type: LibraryTrack | DuplicateLibraryItemError | TidalApiUnavailableError
     */
    addTrackToLibrary: async (
      _parent: unknown,
      args: { input: { tidalTrackId: string } },
      context: LibraryContext,
    ) => {
      requireAuth(context, "addTrackToLibrary");
      const { tidalTrackId } = args.input;

      try {
        const track = await context.libraryService.addTrackToLibrary(
          tidalTrackId,
          context.userId,
        );
        return {
          __typename: "LibraryTrack",
          ...track,
        };
      } catch (error) {
        if (error instanceof DuplicateItemError) {
          return {
            __typename: "DuplicateLibraryItemError",
            message: error.message,
            existingItemId: error.existingItemId,
          };
        }

        if (error instanceof TidalApiError) {
          return {
            __typename: "TidalApiUnavailableError",
            message: error.message,
            retryable: error.retryable,
          };
        }

        logger.error("add_track_to_library_resolver_error", {
          tidalTrackId,
          error: String(error),
        });

        // Generic error - return as TidalApiUnavailableError with retryable: false
        return {
          __typename: "TidalApiUnavailableError",
          message: "An unexpected error occurred while adding track to library",
          retryable: false,
        };
      }
    },

    /**
     * Remove an album from the user's library
     * Returns true if successful, throws error if album not found
     */
    removeAlbumFromLibrary: async (
      _parent: unknown,
      args: { id: string },
      context: LibraryContext,
    ) => {
      requireAuth(context, "removeAlbumFromLibrary");
      try {
        return await context.libraryService.removeAlbumFromLibrary(
          args.id,
          context.userId,
        );
      } catch (error) {
        if (
          error instanceof LibraryError &&
          error.type === ErrorType.NOT_FOUND
        ) {
          throw new GraphQLError("Album not found in library", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        logger.error("remove_album_from_library_resolver_error", {
          id: args.id,
          error: String(error),
        });

        throw new GraphQLError("Failed to remove album from library", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Remove a track from the user's library
     * Returns true if successful, throws error if track not found
     */
    removeTrackFromLibrary: async (
      _parent: unknown,
      args: { id: string },
      context: LibraryContext,
    ) => {
      requireAuth(context, "removeTrackFromLibrary");
      try {
        return await context.libraryService.removeTrackFromLibrary(
          args.id,
          context.userId,
        );
      } catch (error) {
        if (
          error instanceof LibraryError &&
          error.type === ErrorType.NOT_FOUND
        ) {
          throw new GraphQLError("Track not found in library", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        logger.error("remove_track_from_library_resolver_error", {
          id: args.id,
          error: String(error),
        });

        throw new GraphQLError("Failed to remove track from library", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },

  /**
   * Union type resolver for AddAlbumToLibraryResult
   * Determines which concrete type to return based on __typename
   */
  AddAlbumToLibraryResult: {
    __resolveType(obj: any) {
      return obj.__typename;
    },
  },

  /**
   * Union type resolver for AddTrackToLibraryResult
   * Determines which concrete type to return based on __typename
   */
  AddTrackToLibraryResult: {
    __resolveType(obj: any) {
      return obj.__typename;
    },
  },

  /**
   * Field resolvers for LibraryAlbum type
   */
  LibraryAlbum: {
    // Convert Date to ISO 8601 string for GraphQL
    createdAt: (parent: any) => {
      if (!parent.createdAt) return null;
      return parent.createdAt instanceof Date
        ? parent.createdAt.toISOString()
        : parent.createdAt;
    },
    releaseDate: (parent: any) => {
      if (!parent.releaseDate) return null;
      if (parent.releaseDate instanceof Date) {
        return parent.releaseDate.toISOString().split("T")[0]; // YYYY-MM-DD format
      }
      // If it's already a string (from database), return as-is or format it
      if (typeof parent.releaseDate === "string") {
        return parent.releaseDate.split("T")[0];
      }
      return null;
    },
    trackListing: (parent: any) => {
      // Ensure track durations are integers, parsing ISO 8601 if needed
      if (!parent.trackListing || !Array.isArray(parent.trackListing)) {
        return [];
      }
      return parent.trackListing.map((track: any) => {
        let duration = track.duration;
        // If duration is an ISO 8601 string, parse it
        if (typeof duration === "string" && duration.startsWith("PT")) {
          const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (match) {
            const hours = parseInt(match[1] || "0");
            const minutes = parseInt(match[2] || "0");
            const seconds = parseInt(match[3] || "0");
            duration = hours * 3600 + minutes * 60 + seconds;
          } else {
            duration = 0;
          }
        }
        return {
          ...track,
          duration: typeof duration === "number" ? duration : 0,
        };
      });
    },
  },

  /**
   * Field resolvers for LibraryTrack type
   */
  LibraryTrack: {
    // Convert Date to ISO 8601 string for GraphQL
    createdAt: (parent: any) => {
      if (!parent.createdAt) return null;
      return parent.createdAt instanceof Date
        ? parent.createdAt.toISOString()
        : parent.createdAt;
    },
  },
};
