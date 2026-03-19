import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { listContacts, resolveContacts, type Contact } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface ContactsContextValue {
  contacts: Contact[];
  nameMap: Record<string, string>;
  resolve: (identifiers: string[]) => Promise<void>;
  refresh: () => Promise<void>;
  displayName: (identifier: string | undefined | null) => string;
}

const ContactsContext = createContext<ContactsContextValue>({
  contacts: [],
  nameMap: {},
  resolve: async () => {},
  refresh: async () => {},
  displayName: (id) => id ?? "",
});

export function ContactsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const list = await listContacts();
      setContacts(list);
      const map: Record<string, string> = {};
      for (const c of list) {
        map[c.identifier] = c.name;
      }
      setNameMap(map);
    } catch {
      // silently fail
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resolve = useCallback(
    async (identifiers: string[]) => {
      const unknown = identifiers.filter((id) => id && !(id in nameMap));
      if (unknown.length === 0) return;
      try {
        const res = await resolveContacts(unknown);
        setNameMap((prev) => ({ ...prev, ...res.names }));
      } catch {
        // silently fail
      }
    },
    [nameMap],
  );

  const displayName = useCallback(
    (identifier: string | undefined | null) => {
      if (!identifier) return "";
      return nameMap[identifier] ?? identifier;
    },
    [nameMap],
  );

  return (
    <ContactsContext.Provider
      value={{ contacts, nameMap, resolve, refresh, displayName }}
    >
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  return useContext(ContactsContext);
}
