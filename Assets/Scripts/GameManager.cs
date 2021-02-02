using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    private GameObject[] players_1;
    private GameObject[] players_2;
    public GameObject player_prefab1;
    public GameObject player_prefab2;
    public GameObject ball_prefab;
    public GameObject restart_button;

    // Start is called before the first frame update
    void Start()
    {
        // Spawn Player1
        Instantiate(player_prefab1, new Vector3(4f, 2f, 0f), Quaternion.identity);
        Instantiate(player_prefab1, new Vector3(4f, -2f, 0f), Quaternion.identity);
        Instantiate(player_prefab1, new Vector3(3.5f, 0f, 0f), Quaternion.identity);

        // Spawn Player2
        Instantiate(player_prefab2, new Vector3(-4f, 2f, 0f), Quaternion.identity);
        Instantiate(player_prefab2, new Vector3(-4f, -2f, 0f), Quaternion.identity);
        Instantiate(player_prefab2, new Vector3(-3.5f, 0f, 0f), Quaternion.identity);

        players_1 = GameObject.FindGameObjectsWithTag("Player1");
        players_2 = GameObject.FindGameObjectsWithTag("Player2");

        // Spawn Ball
        Instantiate(ball_prefab, Vector3.zero, Quaternion.identity);

    }

    // Update is called once per frame
    void Update()
    {
        if (Input.GetKey(KeyCode.Space))
        {
            Debug.Log("Entering move players loop.  Array length: " + players_1.Length);
            Debug.Log("Player 1: " + players_1[0].GetComponent<PlayerController>().is_alive);
            for (int i = 0; i < players_1.Length; i++)
            {
                Debug.Log("Moving players: " + i);
                players_1[i].GetComponent<PlayerController>().ExecuteMove();
                players_2[i].GetComponent<PlayerController>().ExecuteMove();
            }
        }
    }

    public void EndGame()
    {
        // Activate Restart Button
        restart_button.SetActive(true);
    }

    public void RestartGame()
    {
        SceneManager.LoadScene(SceneManager.GetActiveScene().name);
    }
}
