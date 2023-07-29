import { useUser, SignOutButton } from "@clerk/nextjs";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { type RouterOutputs, api } from "~/utils/api";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { LoadingPage, LoadingSpinner } from "~/components/loading";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { PageLayout } from "~/components/page-layout";

dayjs.extend(relativeTime);

const CreatePostWizard = () => {
  const [input, setInput] = useState("");

  const { user } = useUser();
  const ctx = api.useContext();

  const { mutate, isLoading: isPosting } = api.post.create.useMutation({
    onSuccess: () => {
      setInput("");
      // returns promise but we don't need to await it, as it is a background process
      // `void` indicates this to TS
      void ctx.post.getAll.invalidate();
    },
    onError: (e) => {
      const errorMessage = e.data?.zodError?.fieldErrors.content;

      console.log("zodError", e.data);

      if (errorMessage?.[0]) {
        toast.error(errorMessage[0]);
      } else {
        toast.error("Too many recent posts! Try again later.");
      }
    },
  });

  if (!user) return null;

  return (
    <div className="flex w-full gap-4">
      <div className="flex items-center">
        <Image
          src={user.profileImageUrl}
          width="48"
          height="48"
          alt="profile image"
          className="rounded-full"
        />
      </div>
      <input
        className="grow rounded bg-transparent p-2 outline-none focus:outline-slate-600"
        placeholder="Type some emojis!"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (input !== "") mutate({ content: input });
          }
        }}
        disabled={isPosting}
      />
      {input !== "" && !isPosting && (
        <button onClick={() => mutate({ content: input })} disabled={isPosting}>
          Post
        </button>
      )}
      {isPosting && (
        <div className="flex items-center justify-center">
          <LoadingSpinner size={24} />
        </div>
      )}
    </div>
  );
};

/**
 * RouterOutputs is a helper that allows us to access the types of our tRPC router
 * Here we're using it to get the type of a SINGLE post from the array returned by api.post.getAll */
type PostWithAuthor = RouterOutputs["post"]["getAll"][number];

const PostView = ({ post, author }: PostWithAuthor) => {
  return (
    <div className="flex items-center gap-4 border-b border-slate-400 p-8">
      <Image
        className="rounded-full"
        src={author?.profileImageUrl ?? ""}
        alt={`@${author.username}'s profile image`}
        width="48"
        height="48"
      />

      <div key={post.id} className="flex flex-col">
        <div className="flex gap-2 font-bold text-slate-400 ">
          <Link href={`/@${author.username}`}>
            <span className="hover:underline">{`@${author.username}`}</span>
          </Link>
          <span className="font-bold">·</span>
          <Link href={`/post/${post.id}`}>
            <span className="font-thin hover:underline">{`${dayjs(
              post.createdAt
            ).fromNow()}`}</span>
          </Link>
        </div>
        <span className="text-2xl">{post.content}</span>
      </div>
    </div>
  );
};

const Feed = () => {
  // Will use cached data if available and not invalidated
  const posts = api.post.getAll.useQuery();

  if (posts.isLoading) return <LoadingPage size={64} />;
  if (!posts.data) return <div>Something went wrong...</div>;

  return (
    <div className="flex flex-col">
      {posts.data?.map((postWithAuthor) => (
        <PostView key={postWithAuthor.post.id} {...postWithAuthor} />
      ))}
    </div>
  );
};

export default function Home() {
  const user = useUser();

  /** Start fetching posts ASAP
   * NOTE: we still fetch posts here (even though we don't use it here) to make sure the data starts fetching early (i.e. before <Feed /> renders)
   * Because we fetch this early, React Query will cache the first fetch
   * When <Feed /> renders, it will use the cached data (rather than refetching)
   */
  api.post.getAll.useQuery();

  // Return empty div if User isn't loaded, since user tends to load faster
  if (!user.isLoaded) return <div />;

  return (
    <>
      <PageLayout>
        <div className="flex justify-between gap-4 border-b border-slate-400 p-4">
          <CreatePostWizard />
          {user.isSignedIn && (
            <div className="flex min-w-max items-center justify-center ">
              <SignOutButton>
                <button className="rounded bg-slate-800 p-4 hover:bg-opacity-90">
                  Sign Out
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
        <Feed />
      </PageLayout>
    </>
  );
}
