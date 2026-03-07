import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Admin() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return <p style={{ padding: 40 }}>Redirection...</p>;
}
